import crypto from 'node:crypto';
import { parseBulkFile } from '../../utils/bulkFileParser.js';
import { produccionSemanalRepository } from '../../repositories/agricola/produccionSemanal.repository.js';
import { Finca, Semana } from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';
import { getFincaIdsPermitidas, assertFincaPermitida, expandirFincaIds } from '../../utils/fincaScope.js';
import { env } from '../../config/env.config.js';
import mysqlHttpBridge from '../../database/mysqlHttpBridge.cjs';

// Mismo tope y misma lógica de "menos peticiones, más grandes" que el
// cargue masivo de Movimientos de Racimos (ver ese servicio para más
// contexto) — un archivo con demasiadas filas no cabe en el tiempo de
// ejecución de la función serverless, y en modo bridge cada tanda de 500
// filas era antes una petición HTTP aparte al túnel.
const MAX_FILAS_BULK = 15000;
const FILAS_POR_STATEMENT = 2000;
const STATEMENTS_POR_PETICION = 5;

const construirInsertMultifila = (filas) => {
  const columnas = ['uuid', 'semana_id', 'finca_id', 'cajas_20kg', 'created_by'];
  const grupo = `(${columnas.map(() => '?').join(',')}, NOW(), NOW())`;
  const sql = `INSERT INTO produccion_semanal (${columnas.join(',')}, created_at, updated_at) VALUES ${filas.map(() => grupo).join(',')}`;
  const params = [];
  for (const f of filas) {
    params.push(crypto.randomUUID(), f.semanaId, f.fincaId, f.cajas20kg, f.createdBy);
  }
  return { sql, params };
};

// Igual que construirInsertMultifila, pero con ON DUPLICATE KEY UPDATE sobre
// el índice único (semana_id, finca_id) — inserta las filas nuevas y
// sobrescribe `cajas_20kg` de las que ya existían, en una sola sentencia.
const construirUpsertMultifila = (filas) => {
  const columnas = ['uuid', 'semana_id', 'finca_id', 'cajas_20kg', 'created_by'];
  const grupo = `(${columnas.map(() => '?').join(',')}, NOW(), NOW())`;
  const sql =
    `INSERT INTO produccion_semanal (${columnas.join(',')}, created_at, updated_at) VALUES ${filas.map(() => grupo).join(',')} ` +
    'ON DUPLICATE KEY UPDATE cajas_20kg = VALUES(cajas_20kg), updated_by = VALUES(created_by), updated_at = NOW()';
  const params = [];
  for (const f of filas) {
    params.push(crypto.randomUUID(), f.semanaId, f.fincaId, f.cajas20kg, f.createdBy);
  }
  return { sql, params };
};

async function insertarViaBridgeBatch(filas) {
  let creados = 0;
  const filasPorPeticion = FILAS_POR_STATEMENT * STATEMENTS_POR_PETICION;
  for (let i = 0; i < filas.length; i += filasPorPeticion) {
    const grupoGrande = filas.slice(i, i + filasPorPeticion);
    const queries = [];
    for (let j = 0; j < grupoGrande.length; j += FILAS_POR_STATEMENT) {
      queries.push(construirInsertMultifila(grupoGrande.slice(j, j + FILAS_POR_STATEMENT)));
    }
    await mysqlHttpBridge.sendBatch(env.db.bridgeUrl, env.db.bridgeApiKey, queries);
    creados += grupoGrande.length;
  }
  return creados;
}

async function upsertViaBridgeBatch(filas) {
  const filasPorPeticion = FILAS_POR_STATEMENT * STATEMENTS_POR_PETICION;
  for (let i = 0; i < filas.length; i += filasPorPeticion) {
    const grupoGrande = filas.slice(i, i + filasPorPeticion);
    const queries = [];
    for (let j = 0; j < grupoGrande.length; j += FILAS_POR_STATEMENT) {
      queries.push(construirUpsertMultifila(grupoGrande.slice(j, j + FILAS_POR_STATEMENT)));
    }
    await mysqlHttpBridge.sendBatch(env.db.bridgeUrl, env.db.bridgeApiKey, queries);
  }
}

// Valida las filas crudas del archivo contra los catálogos de finca/semana
// y el alcance del usuario — compartido entre el cargue masivo (crea, salta
// duplicados) y la actualización masiva (crea, sobrescribe duplicados).
function validarFilasProduccion(filas, { fincaPorCodigo, semanaPorCodigo, fincaIdsPermitidas, actorId }) {
  const errores = [];
  const filasValidas = [];

  for (let i = 0; i < filas.length; i++) {
    const row = filas[i];
    const nro = i + 2;

    const semanaCodigo = String(row.semana || row.semanacodigo || '').trim();
    const fincaCodigo = String(row.fincacodigo || row.finca || row.codigofinca || '').trim().toUpperCase();
    const cajasRaw = Number(row.cajas || row.cajas20kg || row.cajasproducidas || row.cajas_20kg || 0);

    if (!semanaCodigo) {
      errores.push({ fila: nro, error: 'Semana no proporcionada' });
      continue;
    }
    if (!fincaCodigo) {
      errores.push({ fila: nro, error: 'Código de finca no proporcionado' });
      continue;
    }

    const semanaId = semanaPorCodigo.get(semanaCodigo);
    if (!semanaId) {
      errores.push({ fila: nro, error: `Semana "${semanaCodigo}" no encontrada` });
      continue;
    }

    const fincaId = fincaPorCodigo.get(fincaCodigo);
    if (!fincaId) {
      errores.push({ fila: nro, error: `Finca "${fincaCodigo}" no encontrada` });
      continue;
    }
    if (fincaIdsPermitidas !== null && !fincaIdsPermitidas.includes(fincaId)) {
      errores.push({ fila: nro, error: `No tienes acceso a la finca "${fincaCodigo}"` });
      continue;
    }

    if (!Number.isFinite(cajasRaw) || cajasRaw < 0) {
      errores.push({ fila: nro, error: `Cajas "${row.cajas || ''}" no es un número válido` });
      continue;
    }

    filasValidas.push({ semanaId, fincaId, cajas20kg: Math.round(cajasRaw), createdBy: actorId });
  }

  return { filasValidas, errores };
}

async function cargarCatalogos() {
  const [todasFincas, todasSemanas] = await Promise.all([
    Finca.findAll({ attributes: ['id', 'codigo'] }),
    Semana.findAll({ attributes: ['id', 'codigo', 'anio', 'numeroSemana'] }),
  ]);
  return {
    fincaPorCodigo: new Map(todasFincas.map((f) => [f.codigo, f.id])),
    semanaPorCodigo: new Map(todasSemanas.map((s) => [s.codigo, s.id])),
  };
}

export const produccionSemanalService = {
  async listProduccion(query, user) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const offset = (page - 1) * limit;

    const fincaId = query.fincaUuid
      ? (await Finca.findOne({ where: { uuid: query.fincaUuid } }))?.id
      : undefined;
    if (fincaId) assertFincaPermitida(user, fincaId);
    // Si pidió una finca puntual, se expande a su Grupo de Finca (ver
    // utils/fincaScope.js); si no, se usa el alcance normal del usuario.
    const fincaIds = fincaId ? await expandirFincaIds([fincaId]) : getFincaIdsPermitidas(user);
    const semanaId = query.semanaUuid
      ? (await Semana.findOne({ where: { uuid: query.semanaUuid } }))?.id
      : undefined;

    const { rows, count } = await produccionSemanalRepository.findAndCountAll({
      limit, offset, fincaIds, semanaId,
    });

    return {
      items: rows,
      page, limit, total: count, totalPages: Math.ceil(count / limit),
    };
  },

  async bulkCreateProduccion(file, actorId, user) {
    const filas = parseBulkFile(file);
    if (filas.length === 0) throw ApiError.badRequest('El archivo está vacío');

    // Ver el mismo límite en racimoMovimiento.service.js: un archivo
    // demasiado grande no cabe en el tiempo de ejecución de la función
    // serverless y se queda colgado sin ningún error visible.
    if (filas.length > MAX_FILAS_BULK) {
      throw ApiError.badRequest(
        `El archivo tiene ${filas.length.toLocaleString('es')} filas — el máximo por cargue es ${MAX_FILAS_BULK.toLocaleString('es')}. ` +
          'Dividilo en partes más chicas (por ejemplo, por año) y subilas una por una.',
      );
    }

    const fincaIdsPermitidas = getFincaIdsPermitidas(user);
    const { fincaPorCodigo, semanaPorCodigo } = await cargarCatalogos();
    const { filasValidas, errores } = validarFilasProduccion(filas, {
      fincaPorCodigo,
      semanaPorCodigo,
      fincaIdsPermitidas,
      actorId,
    });

    if (filasValidas.length === 0) {
      return { totalFilas: filas.length, creados: 0, errores };
    }

    // Consultar registros existentes para filtrar duplicados
    const semanaIds = [...new Set(filasValidas.map((f) => f.semanaId))];
    const fincaIds = [...new Set(filasValidas.map((f) => f.fincaId))];
    const existentes = await produccionSemanalRepository.findAllBySemanaYFinca({ semanaIds, fincaIds });
    const existenteSet = new Set(existentes.map((e) => `${e.semanaId}-${e.fincaId}`));

    // También descarta duplicados DENTRO del mismo archivo (dos filas para
    // la misma finca+semana) — si no, ambas pasan el chequeo contra la BD
    // (ninguna está ahí todavía) y la segunda revienta el INSERT contra el
    // índice único, mostrando un error crudo de SQL en vez de omitirse
    // prolijamente como cualquier otro duplicado.
    const aInsertar = [];
    for (const f of filasValidas) {
      const clave = `${f.semanaId}-${f.fincaId}`;
      if (existenteSet.has(clave)) continue;
      existenteSet.add(clave);
      aInsertar.push(f);
    }
    const saltados = filasValidas.length - aInsertar.length;

    if (aInsertar.length > 0) {
      if (env.db.mode === 'bridge') {
        await insertarViaBridgeBatch(aInsertar);
      } else {
        await produccionSemanalRepository.bulkCreate(aInsertar);
      }
    }

    return {
      totalFilas: filas.length,
      creados: aInsertar.length,
      saltados,
      errores: errores.length > 0 ? errores : undefined,
    };
  },

  // Igual que bulkCreateProduccion, pero para corregir un cargue con
  // errores: en vez de saltar las filas de finca+semana que ya existen,
  // sobrescribe sus cajas con el valor del archivo. Las que no existen se
  // crean igual (upsert). Solo Administrador (ver
  // PERMISSIONS.PRODUCCION_ACTUALIZAR_MASIVO) — permite corregir en bloque
  // sin tener que borrar e importar de nuevo fila por fila.
  async bulkUpdateProduccion(file, actorId, user) {
    const filas = parseBulkFile(file);
    if (filas.length === 0) throw ApiError.badRequest('El archivo está vacío');

    if (filas.length > MAX_FILAS_BULK) {
      throw ApiError.badRequest(
        `El archivo tiene ${filas.length.toLocaleString('es')} filas — el máximo por cargue es ${MAX_FILAS_BULK.toLocaleString('es')}. ` +
          'Dividilo en partes más chicas (por ejemplo, por año) y subilas una por una.',
      );
    }

    const fincaIdsPermitidas = getFincaIdsPermitidas(user);
    const { fincaPorCodigo, semanaPorCodigo } = await cargarCatalogos();
    const { filasValidas, errores } = validarFilasProduccion(filas, {
      fincaPorCodigo,
      semanaPorCodigo,
      fincaIdsPermitidas,
      actorId,
    });

    if (filasValidas.length === 0) {
      return { totalFilas: filas.length, actualizados: 0, creados: 0, errores };
    }

    // Para informar cuántas eran correcciones vs. filas realmente nuevas —
    // el upsert en sí no distingue, así que se compara contra lo que ya
    // había antes de escribir.
    const semanaIds = [...new Set(filasValidas.map((f) => f.semanaId))];
    const fincaIds = [...new Set(filasValidas.map((f) => f.fincaId))];
    const existentes = await produccionSemanalRepository.findAllBySemanaYFinca({ semanaIds, fincaIds });
    const existenteSet = new Set(existentes.map((e) => `${e.semanaId}-${e.fincaId}`));
    const actualizados = filasValidas.filter((f) => existenteSet.has(`${f.semanaId}-${f.fincaId}`)).length;

    if (env.db.mode === 'bridge') {
      await upsertViaBridgeBatch(filasValidas);
    } else {
      await produccionSemanalRepository.bulkUpsert(filasValidas);
    }

    return {
      totalFilas: filas.length,
      actualizados,
      creados: filasValidas.length - actualizados,
      errores: errores.length > 0 ? errores : undefined,
    };
  },

  async getProduccionByUuid(uuid, user) {
    const registro = await produccionSemanalRepository.findByUuid(uuid);
    if (!registro) throw ApiError.notFound('Registro de producción no encontrado');
    assertFincaPermitida(user, registro.fincaId);
    return registro;
  },

  async deleteProduccion(uuid, actorId, user) {
    const registro = await this.getProduccionByUuid(uuid, user);
    await produccionSemanalRepository.softDelete(registro, actorId);
  },
};

export default produccionSemanalService;
