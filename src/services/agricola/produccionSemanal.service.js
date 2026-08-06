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
    const errores = [];
    const filasValidas = [];

    // Pre-cache catálogos
    const todasFincas = await Finca.findAll({ attributes: ['id', 'codigo'] });
    const todasSemanas = await Semana.findAll({ attributes: ['id', 'codigo', 'anio', 'numeroSemana'] });

    const fincaPorCodigo = new Map(todasFincas.map((f) => [f.codigo, f.id]));
    const semanaPorCodigo = new Map(todasSemanas.map((s) => [s.codigo, s.id]));

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

    if (filasValidas.length === 0) {
      return { totalFilas: filas.length, creados: 0, errores };
    }

    // Consultar registros existentes para filtrar duplicados
    const semanaIds = [...new Set(filasValidas.map((f) => f.semanaId))];
    const fincaIds = [...new Set(filasValidas.map((f) => f.fincaId))];
    const existentes = await produccionSemanalRepository.findAllBySemanaYFinca({ semanaIds, fincaIds });
    const existenteSet = new Set(existentes.map((e) => `${e.semanaId}-${e.fincaId}`));

    const aInsertar = filasValidas.filter((f) => !existenteSet.has(`${f.semanaId}-${f.fincaId}`));
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
};

export default produccionSemanalService;
