import crypto from 'node:crypto';
import { Op } from 'sequelize';
import { sequelize } from '../../database/connection.js';
import { Finca, Lote, Semana, MotivoRepique, MotivoRecuse } from '../../database/associations.js';
import { racimoMovimientoRepository } from '../../repositories/agricola/racimoMovimiento.repository.js';
import { semanaRepository } from '../../repositories/agricola/semana.repository.js';
import { calcularColorSemana } from '../../utils/semanaColor.js';
import { parseBulkFile } from '../../utils/bulkFileParser.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { logger } from '../../utils/logger.js';
import { bulkProgress } from '../../utils/bulkProgress.js';
import { bulkValidationCache } from '../../utils/bulkValidationCache.js';
import { getFincaIdsPermitidas, assertFincaPermitida, expandirFincaIds } from '../../utils/fincaScope.js';
import { ROLES } from '../../constants/roles.constants.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { env } from '../../config/env.config.js';
import mysqlHttpBridge from '../../database/mysqlHttpBridge.cjs';

// Cargue masivo en modo bridge: en vez de una petición HTTP por cada tanda
// de 500 filas (lo normal con Sequelize), se agrupan muchas más filas por
// INSERT multi-fila, y varios de esos INSERT se mandan juntos en una sola
// petición HTTP (acción 'batch' del gateway.php) — reduce drásticamente el
// volumen de tráfico al túnel, que es lo que dispara los bloqueos del
// firewall del hosting bajo cargas grandes.
const FILAS_POR_STATEMENT = 2000;
const STATEMENTS_POR_PETICION = 5;

const construirInsertMultifila = (filas) => {
  const columnas = [
    'uuid', 'finca_id', 'lote_id', 'semana_embolse_id', 'semana_registro_id', 'tipo',
    'motivo_repique_id', 'motivo_recuse_id', 'cantidad', 'fecha', 'observacion', 'created_by',
  ];
  const grupo = `(${columnas.map(() => '?').join(',')}, NOW(), NOW())`;
  const sql = `INSERT INTO racimo_movimientos (${columnas.join(',')}, created_at, updated_at) VALUES ${filas.map(() => grupo).join(',')}`;
  const params = [];
  for (const f of filas) {
    params.push(
      crypto.randomUUID(),
      f.fincaId,
      f.loteId,
      f.semanaEmbolseId,
      f.semanaRegistroId,
      f.tipo,
      f.motivoRepiqueId,
      f.motivoRecuseId,
      f.cantidad,
      f.fecha,
      f.observacion ?? null,
      f.createdBy,
    );
  }
  return { sql, params };
};

async function insertarViaBridgeBatch(filasValidas, onProgreso) {
  let creados = 0;
  const filasPorPeticion = FILAS_POR_STATEMENT * STATEMENTS_POR_PETICION;
  for (let i = 0; i < filasValidas.length; i += filasPorPeticion) {
    const grupoGrande = filasValidas.slice(i, i + filasPorPeticion);
    const queries = [];
    for (let j = 0; j < grupoGrande.length; j += FILAS_POR_STATEMENT) {
      queries.push(construirInsertMultifila(grupoGrande.slice(j, j + FILAS_POR_STATEMENT)));
    }
    await mysqlHttpBridge.sendBatch(env.db.bridgeUrl, env.db.bridgeApiKey, queries);
    creados += grupoGrande.length;
    onProgreso(creados);
  }
  return creados;
}

// Además del Administrador (que se salta toda restricción), un usuario con
// este permiso puntual también puede crear/eliminar movimientos de semanas
// anteriores a la última registrada en una finca, sin heredar el resto de
// los poderes de Administrador.
const puedeIgnorarRestriccionSemana = (user) =>
  (user?.roles || []).includes(ROLES.ADMINISTRADOR) ||
  (user?.permissions || []).includes(PERMISSIONS.RACIMO_MOVIMIENTO_EDITAR_HISTORICO);

const TIPOS_VALIDOS = ['EMBOLSE', 'REPIQUE', 'RECUSE', 'PROCESADO'];

// Tope de filas por cargue masivo — ver comentario en bulkCreateMovimientos.
const MAX_FILAS_BULK = 15000;

const findFincaByUuidOrFail = async (uuid) => {
  const finca = await Finca.findOne({ where: { uuid } });
  if (!finca) throw ApiError.notFound('Finca no encontrada');
  return finca;
};

const findLoteByUuidOrFail = async (uuid) => {
  const lote = await Lote.findOne({ where: { uuid } });
  if (!lote) throw ApiError.notFound('Lote no encontrado');
  return lote;
};

const findSemanaByUuidOrFail = async (uuid) => {
  const semana = await Semana.findOne({ where: { uuid } });
  if (!semana) throw ApiError.notFound('Semana no encontrada');
  return semana;
};

const findMotivoRepiqueByUuidOrFail = async (uuid) => {
  const motivo = await MotivoRepique.findOne({ where: { uuid } });
  if (!motivo) throw ApiError.notFound('Motivo de repique no encontrado');
  return motivo;
};

const findMotivoRecuseByUuidOrFail = async (uuid) => {
  const motivo = await MotivoRecuse.findOne({ where: { uuid } });
  if (!motivo) throw ApiError.notFound('Motivo de recuse no encontrado');
  return motivo;
};

// Valida coherencia tipo <-> motivo: EMBOLSE y PROCESADO no llevan motivo;
// REPIQUE exige motivo de repique; RECUSE exige motivo de recuse.
async function resolveMotivos(tipo, payload) {
  if (tipo === 'REPIQUE') {
    if (!payload.motivoRepiqueUuid) throw ApiError.badRequest('El repique requiere un motivo de repique');
    if (payload.motivoRecuseUuid) throw ApiError.badRequest('Un repique no lleva motivo de recuse');
    return { motivoRepiqueId: (await findMotivoRepiqueByUuidOrFail(payload.motivoRepiqueUuid)).id, motivoRecuseId: null };
  }
  if (tipo === 'RECUSE') {
    if (!payload.motivoRecuseUuid) throw ApiError.badRequest('El recuse requiere un motivo de recuse');
    if (payload.motivoRepiqueUuid) throw ApiError.badRequest('Un recuse no lleva motivo de repique');
    return { motivoRepiqueId: null, motivoRecuseId: (await findMotivoRecuseByUuidOrFail(payload.motivoRecuseUuid)).id };
  }
  if (payload.motivoRepiqueUuid || payload.motivoRecuseUuid) {
    throw ApiError.badRequest(`${tipo} no admite motivo de repique ni de recuse`);
  }
  return { motivoRepiqueId: null, motivoRecuseId: null };
}

export const racimoMovimientoService = {
  async listMovimientos(query, user) {
    const { page, limit, offset } = getPagination(query);

    const fincaId = query.fincaUuid ? (await findFincaByUuidOrFail(query.fincaUuid)).id : undefined;
    if (fincaId) assertFincaPermitida(user, fincaId);
    // Si pidió una finca puntual, se expande a su Grupo de Finca (ver
    // utils/fincaScope.js); si no, se usa el alcance normal del usuario.
    const fincaIds = fincaId ? await expandirFincaIds([fincaId]) : getFincaIdsPermitidas(user);
    const loteId = query.loteUuid ? (await findLoteByUuidOrFail(query.loteUuid)).id : undefined;
    const semanaEmbolseId = query.semanaEmbolseUuid
      ? (await findSemanaByUuidOrFail(query.semanaEmbolseUuid)).id
      : undefined;
    const semanaRegistroId = query.semanaRegistroUuid
      ? (await findSemanaByUuidOrFail(query.semanaRegistroUuid)).id
      : undefined;

    // Rango de semanas de registro: filtra por el campo `semanaRegistroId`
    // guardado en cada movimiento (no por su `fecha` real) — un movimiento
    // puede tener una fecha que cae en otra semana calendario que la semana
    // de registro que se le asignó (ej. cargues masivos donde la semana de
    // registro se dejó igual a la de embolse), así que filtrar por fecha
    // podía traer/perder filas que no coinciden con lo que se ve en la
    // columna "Semana Registro" de la tabla.
    let fechaDesde = query.fechaDesde;
    let fechaHasta = query.fechaHasta;
    let semanaRegistroIds;
    if (query.semanaRegistroDesdeUuid && query.semanaRegistroHastaUuid) {
      const [semanaDesde, semanaHasta] = await Promise.all([
        findSemanaByUuidOrFail(query.semanaRegistroDesdeUuid),
        findSemanaByUuidOrFail(query.semanaRegistroHastaUuid),
      ]);
      const semanas = await semanaRepository.findEntreSemanas(semanaDesde, semanaHasta);
      semanaRegistroIds = semanas.map((s) => s.id);
    } else {
      if (query.semanaRegistroDesdeUuid) {
        fechaDesde = (await findSemanaByUuidOrFail(query.semanaRegistroDesdeUuid)).fechaInicio;
      }
      if (query.semanaRegistroHastaUuid) {
        fechaHasta = (await findSemanaByUuidOrFail(query.semanaRegistroHastaUuid)).fechaFin;
      }
    }

    const { rows, count } = await racimoMovimientoRepository.findAndCountAll({
      limit,
      offset,
      fincaIds,
      loteId,
      semanaEmbolseId,
      semanaRegistroId,
      semanaRegistroIds,
      tipo: query.tipo,
      fechaDesde,
      fechaHasta,
    });

    // Le marca a cada fila si es "histórica" (de una semana anterior a la
    // última registrada en su finca) — usa exactamente la misma fuente que
    // create/deleteMovimiento (getUltimaSemanaRegistroPorFinca), para que el
    // frontend pueda ocultar el botón de eliminar en esas filas sin tener
    // que adivinar o duplicar la regla. `puedeEliminarHistorico` le dice al
    // frontend si igual puede actuar sobre esas filas (Administrador o con
    // el permiso puntual), para no ocultarlas de más.
    const fincaIdsDeFilas = [...new Set(rows.map((r) => r.fincaId))];
    const ultimaPorFinca = await racimoMovimientoRepository.getUltimaSemanaRegistroPorFinca(fincaIdsDeFilas);
    const items = rows.map((r) => {
      const ultima = ultimaPorFinca.get(r.fincaId);
      const esHistorico = Boolean(ultima && r.semanaRegistro?.fechaInicio < ultima.fechaInicio);
      return { ...r.toJSON(), esHistorico };
    });

    return {
      items,
      meta: {
        ...buildPaginationMeta({ page, limit, total: count }),
        puedeEliminarHistorico: puedeIgnorarRestriccionSemana(user),
      },
    };
  },

  async exportMovimientosToExcel(query, user) {
    const { default: XLSX } = await import('xlsx');

    const tieneFiltroSemanaRegistro = query.semanaRegistroDesdeUuid && query.semanaRegistroHastaUuid;
    const tieneFiltroSemanaEmbolse = !!query.semanaEmbolseUuid;
    if (!tieneFiltroSemanaRegistro && !tieneFiltroSemanaEmbolse) {
      throw ApiError.badRequest('Debe filtrar por rango de semana de registro o por semana de embolse para exportar');
    }

    const fincaId = query.fincaUuid ? (await findFincaByUuidOrFail(query.fincaUuid)).id : undefined;
    if (fincaId) assertFincaPermitida(user, fincaId);
    const loteId = query.loteUuid ? (await findLoteByUuidOrFail(query.loteUuid)).id : undefined;
    const semanaEmbolseId = query.semanaEmbolseUuid
      ? (await findSemanaByUuidOrFail(query.semanaEmbolseUuid)).id
      : undefined;

    // Mismo criterio que listMovimientos: filtra por `semanaRegistroId`
    // guardado, no por la `fecha` real del movimiento (ver comentario ahí).
    let fechaDesde = query.fechaDesde;
    let fechaHasta = query.fechaHasta;
    let semanaRegistroIds;
    if (query.semanaRegistroDesdeUuid && query.semanaRegistroHastaUuid) {
      const [semanaDesde, semanaHasta] = await Promise.all([
        findSemanaByUuidOrFail(query.semanaRegistroDesdeUuid),
        findSemanaByUuidOrFail(query.semanaRegistroHastaUuid),
      ]);
      const semanas = await semanaRepository.findEntreSemanas(semanaDesde, semanaHasta);
      semanaRegistroIds = semanas.map((s) => s.id);
    } else {
      if (query.semanaRegistroDesdeUuid) {
        fechaDesde = (await findSemanaByUuidOrFail(query.semanaRegistroDesdeUuid)).fechaInicio;
      }
      if (query.semanaRegistroHastaUuid) {
        fechaHasta = (await findSemanaByUuidOrFail(query.semanaRegistroHastaUuid)).fechaFin;
      }
    }

    const rows = await racimoMovimientoRepository.findAllForExport({
      fincaId, fincaIds: getFincaIdsPermitidas(user), loteId, semanaEmbolseId,
      semanaRegistroIds, tipo: query.tipo, fechaDesde, fechaHasta,
    });

    const FILAS_POR_HOJA = 50000;
    const wb = XLSX.utils.book_new();

    for (let i = 0; i < rows.length; i += FILAS_POR_HOJA) {
      const bloque = rows.slice(i, i + FILAS_POR_HOJA);
      const datos = bloque.map((r) => ({
        Fecha: r.fecha ? new Date(r.fecha).toLocaleDateString('es-CR') : '',
        'Semana Registro': r.semanaRegistro?.codigo || '',
        'Semana Embolse': r.semanaEmbolse?.codigo || '',
        Cinta: r.semanaEmbolse?.color || '',
        Finca: r.finca?.nombre || '',
        Lote: r.lote?.nombre || '',
        Tipo: r.tipo || '',
        Motivo: r.motivoRepique?.nombre || r.motivoRecuse?.nombre || '',
        Cantidad: r.tipo === 'EMBOLSE' ? r.cantidad : -(r.cantidad || 0),
        Usuario: r.creadoPor?.usuario || 'Sistema',
      }));
      const ws = XLSX.utils.json_to_sheet(datos);
      const nombreHoja = rows.length <= FILAS_POR_HOJA ? 'Movimientos' : `Movimientos ${i / FILAS_POR_HOJA + 1}`;
      XLSX.utils.book_append_sheet(wb, ws, nombreHoja);
    }

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return buffer;
  },

  // Reporte semanal para cargar en el sistema externo: una hoja por tipo de
  // movimiento (Embolse/Repique/Recuse/Procesado), con las columnas exactas
  // que espera esa plantilla. Se agrupa por cohorte (finca + lote + semana
  // de embolse + motivo) sumando cantidad — el formato destino no distingue
  // movimientos individuales del mismo día, solo el total por novedad.
  async exportReporteSemanal(query, user) {
    const { default: XLSX } = await import('xlsx');

    const semana = await findSemanaByUuidOrFail(query.semanaUuid);
    const tipo = query.tipo;

    const rows = await racimoMovimientoRepository.findAllForExport({
      semanaRegistroId: semana.id,
      tipo,
      fincaIds: getFincaIdsPermitidas(user),
    });

    const pad2 = (v) => String(v ?? '').trim().padStart(2, '0');
    const MS_POR_SEMANA = 7 * 24 * 60 * 60 * 1000;

    const grupos = new Map();
    for (const r of rows) {
      const motivoId = r.motivoRepiqueId || r.motivoRecuseId || null;
      const key = `${r.fincaId}-${r.loteId}-${r.semanaEmbolseId}-${motivoId}`;
      if (!grupos.has(key)) {
        grupos.set(key, {
          finca: r.finca,
          lote: r.lote,
          semanaEmbolse: r.semanaEmbolse,
          motivo: r.motivoRepique || r.motivoRecuse || null,
          cantidad: 0,
        });
      }
      grupos.get(key).cantidad += r.cantidad;
    }

    const columnas =
      tipo === 'EMBOLSE'
        ? ['Semana', 'Año', 'Finca', 'Lote', 'Cantidad']
        : tipo === 'PROCESADO'
          ? ['Semana', 'Año', 'Finca', 'Lote', 'Edad', 'Cantidad']
          : ['Semana', 'Año', 'Finca', 'Lote', 'Edad', 'Novedad', 'Cantidad'];

    const datos = [...grupos.values()].map((g) => {
      const fila = {
        Semana: pad2(semana.numeroSemana),
        Año: semana.anio,
        Finca: g.finca?.codigo || '',
        Lote: pad2(g.lote?.nombre),
      };
      if (tipo !== 'EMBOLSE') {
        const semanasTranscurridas = Math.round(
          (new Date(semana.fechaInicio) - new Date(g.semanaEmbolse.fechaInicio)) / MS_POR_SEMANA,
        );
        fila.Edad = pad2(semanasTranscurridas + 1);
      }
      if (tipo === 'REPIQUE' || tipo === 'RECUSE') {
        fila.Novedad = g.motivo?.codigoExterno || '';
      }
      fila.Cantidad = g.cantidad;
      return fila;
    });

    const ws =
      datos.length > 0 ? XLSX.utils.json_to_sheet(datos, { header: columnas }) : XLSX.utils.aoa_to_sheet([columnas]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Hoja1');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  },

  async getMovimientoByUuid(uuid, user) {
    const movimiento = await racimoMovimientoRepository.findByUuid(uuid);
    if (!movimiento) throw ApiError.notFound('Movimiento de racimos no encontrado');
    const permitidas = getFincaIdsPermitidas(user);
    if (permitidas !== null && !permitidas.includes(movimiento.fincaId)) {
      throw ApiError.notFound('Movimiento de racimos no encontrado');
    }
    return movimiento;
  },

  // Resumen de una cohorte puntual (finca + lote + semana de embolse):
  // totales por tipo y saldo disponible, para mostrar antes de registrar
  // un nuevo movimiento sobre esa cohorte.
  async getResumenCohorte(query, user) {
    const finca = await findFincaByUuidOrFail(query.fincaUuid);
    assertFincaPermitida(user, finca.id);
    const lote = await findLoteByUuidOrFail(query.loteUuid);
    const semanaEmbolse = await findSemanaByUuidOrFail(query.semanaEmbolseUuid);

    const resumen = await racimoMovimientoRepository.getResumenCohorte({
      fincaId: finca.id,
      loteId: lote.id,
      semanaEmbolseId: semanaEmbolse.id,
    });

    return {
      semanaEmbolse: {
        uuid: semanaEmbolse.uuid,
        codigo: semanaEmbolse.codigo,
        color: semanaEmbolse.color,
        fechaInicio: semanaEmbolse.fechaInicio,
      },
      ...resumen,
    };
  },

  async createMovimiento(payload, actorId, user) {
    const finca = await findFincaByUuidOrFail(payload.fincaUuid);
    assertFincaPermitida(user, finca.id);
    const lote = await findLoteByUuidOrFail(payload.loteUuid);
    const semanaEmbolse = await findSemanaByUuidOrFail(payload.semanaEmbolseUuid);
    const semanaRegistro = payload.semanaRegistroUuid
      ? await findSemanaByUuidOrFail(payload.semanaRegistroUuid)
      : semanaEmbolse;

    const { motivoRepiqueId, motivoRecuseId } = await resolveMotivos(payload.tipo, payload);

    // Solo un administrador (o alguien con el permiso puntual
    // racimo_movimiento.editar_historico) puede registrar movimientos
    // "hacia atrás": semanas de registro anteriores a la última que ya se
    // usó en esa finca. Evita que un usuario normal descuadre el histórico
    // ya cerrado.
    if (!puedeIgnorarRestriccionSemana(user)) {
      const ultimaPorFinca = await racimoMovimientoRepository.getUltimaSemanaRegistroPorFinca([finca.id]);
      const ultima = ultimaPorFinca.get(finca.id);
      if (ultima && semanaRegistro.fechaInicio < ultima.fechaInicio) {
        throw ApiError.forbidden(
          `Solo un administrador (o alguien con permiso de editar histórico) puede registrar movimientos de semanas anteriores a la última semana registrada en esta finca (${ultima.codigo})`,
        );
      }
    }

    if (payload.tipo !== 'EMBOLSE') {
      const saldo = await racimoMovimientoRepository.getSaldoCohorte({
        fincaId: finca.id,
        loteId: lote.id,
        semanaEmbolseId: semanaEmbolse.id,
      });
      if (payload.cantidad > saldo) {
        throw ApiError.badRequest(
          `La cantidad (${payload.cantidad}) supera el saldo disponible de esa cohorte (${saldo})`,
        );
      }
    }

    return sequelize.transaction((transaction) =>
      racimoMovimientoRepository.create(
        {
          fincaId: finca.id,
          loteId: lote.id,
          semanaEmbolseId: semanaEmbolse.id,
          semanaRegistroId: semanaRegistro.id,
          tipo: payload.tipo,
          motivoRepiqueId,
          motivoRecuseId,
          cantidad: payload.cantidad,
          fecha: payload.fecha,
          observacion: payload.observacion,
          createdBy: actorId,
        },
        { transaction },
      ),
    );
  },

  // Cargue masivo de movimientos históricos desde un .csv/.xlsx. Columnas
  // esperadas: fincaCodigo, loteCodigo, tipo, semanaEmbolseCodigo,
  // semanaRegistroCodigo (opcional, por defecto = semanaEmbolseCodigo),
  // motivo (nombre, requerido para REPIQUE/RECUSE), cantidad, fecha,
  // observacion (opcional).
  //
  // Modos:
  //   dryRun=true  → solo valida, no escribe, devuelve errores si hay
  //   dryRun=false → valida + inserta (cada fila se auto-commitea)
  //   auto         → valida primero; si todo ok, inserta todo en una sola
  //                  transacción (mucho más rápido y atómico)
  async bulkCreateMovimientos(file, actorId, { dryRun = false, mode, progressToken, forceNegativeSaldos = false, esAdmin = false, user } = {}) {
    // Confirmación de saldos negativos: si ya se validó este archivo antes
    // (mismo progressToken, cacheado al pedir confirmación) no hace falta
    // volver a subirlo ni revalidarlo — se insertan directamente las filas
    // que ya habían quedado listas en la primera pasada.
    if (forceNegativeSaldos && progressToken) {
      const cache = bulkValidationCache.get(progressToken);
      if (cache) {
        bulkValidationCache.remove(progressToken);
        bulkProgress.init(progressToken, cache.totalFilas);
        try {
          return await this._insertarYFinalizar(cache.filasValidas, cache.totalFilas, cache.errores, cache.warnings, progressToken);
        } catch (error) {
          bulkProgress.fail(progressToken, error.message || 'Error inesperado durante el cargue');
          throw error;
        }
      }
    }

    if (!file) {
      throw ApiError.badRequest(
        'La validación anterior ya expiró o no se encontró. Selecciona el archivo de nuevo e inténtalo otra vez.',
      );
    }

    const rows = parseBulkFile(file);
    if (rows.length === 0) throw ApiError.badRequest('El archivo no tiene filas para procesar');

    // Un archivo demasiado grande no cabe en el tiempo de ejecución de la
    // función serverless (se corta a mitad de camino, y como el progreso
    // vive en memoria no queda ni rastro de qué se llegó a insertar — la
    // pantalla se queda pegada sin ningún error visible). Mejor rechazarlo
    // de entrada con instrucciones claras que dejar que se cuelgue.
    if (rows.length > MAX_FILAS_BULK) {
      throw ApiError.badRequest(
        `El archivo tiene ${rows.length.toLocaleString('es')} filas — el máximo por cargue es ${MAX_FILAS_BULK.toLocaleString('es')}. ` +
          'Dividilo en partes más chicas (por ejemplo, por semana o por año) y subilas una por una.',
      );
    }

    if (progressToken) bulkProgress.init(progressToken, rows.length);

    try {
      return await this._procesarBulkMovimientos(rows, actorId, { dryRun, mode, progressToken, forceNegativeSaldos, esAdmin, user });
    } catch (error) {
      // Si algo revienta a mitad de camino (BD, bridge, etc.), el frontend
      // debe enterarse por el polling en vez de quedarse esperando para
      // siempre a que 'fase' llegue a 'completado'.
      if (progressToken) bulkProgress.fail(progressToken, error.message || 'Error inesperado durante el cargue');
      throw error;
    }
  },

  async _procesarBulkMovimientos(rows, actorId, { dryRun, mode, progressToken, forceNegativeSaldos, esAdmin, user }) {
    const fincaIdsPermitidas = getFincaIdsPermitidas(user);
    // Distinto de `esAdmin` (que solo gobierna forzar saldo negativo, más
    // abajo): esto también deja pasar a quien tenga el permiso puntual
    // racimo_movimiento.editar_historico, sin ser Administrador.
    const puedeSaltarRestriccionSemana = puedeIgnorarRestriccionSemana(user);
    logger.info(`Precargando catálogos (${rows.length} filas por procesar)...`);

    const [todasFincas, todosLotes, todasSemanas, todosMotivosRepique, todosMotivosRecuse] = await Promise.all([
      Finca.findAll({ raw: true }),
      Lote.findAll({ raw: true }),
      Semana.findAll({ raw: true }),
      MotivoRepique.findAll({ raw: true }),
      MotivoRecuse.findAll({ raw: true }),
    ]);

    const fincaCache = new Map(todasFincas.map((f) => [f.codigo, f]));
    const fincaCodigoPorId = new Map(todasFincas.map((f) => [f.id, f.codigo]));

    const loteCache = new Map();
    for (const l of todosLotes) {
      const fc = fincaCodigoPorId.get(l.fincaId);
      if (fc) loteCache.set(`${fc}-${l.codigo}`, l);
    }

    const semanaCache = new Map(todasSemanas.map((s) => [s.codigo, s]));
    const motivoRepiqueCache = new Map(todosMotivosRepique.map((m) => [m.nombre, m]));
    const motivoRecuseCache = new Map(todosMotivosRecuse.map((m) => [m.nombre, m]));

    // Solo un administrador (o alguien con racimo_movimiento.editar_historico)
    // puede cargar movimientos de semanas anteriores a la última semana de
    // registro ya usada en cada finca (ver la misma regla en
    // createMovimiento). Se calcula una sola vez contra el estado actual de
    // la BD, no fila por fila.
    const ultimaSemanaRegistroPorFinca = puedeSaltarRestriccionSemana
      ? new Map()
      : await racimoMovimientoRepository.getUltimaSemanaRegistroPorFinca(todasFincas.map((f) => f.id));

    const saldoSimulado = new Map();
    const saldoBDCache = new Map();
    const filasValidas = [];

    const errores = [];
    const warnings = [];
    const logInterval = Math.max(1, Math.floor(rows.length / 20));

    logger.info(`Colectando cohortes únicas no-EMBOLSE...`);

    const cohortesUnicos = new Map();

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const fincaCodigo = String(row.fincacodigo || '').trim();
      const loteCodigo = String(row.lotecodigo || '').trim();
      let tipo = String(row.tipo || '').trim().toUpperCase();
      if (tipo === 'CORTE') tipo = 'PROCESADO';
      const semanaEmbolseCodigo = String(row.semanaembolsecodigo || '').trim();
      const cantidad = Number(row.cantidad);

      if (!fincaCodigo || !loteCodigo || !tipo || !semanaEmbolseCodigo || !cantidad) continue;
      if (!TIPOS_VALIDOS.includes(tipo)) continue;
      if (!Number.isInteger(cantidad) || cantidad <= 0) continue;

      if (tipo !== 'EMBOLSE') {
        const finca = fincaCache.get(fincaCodigo);
        if (!finca) continue;
        if (fincaIdsPermitidas !== null && !fincaIdsPermitidas.includes(finca.id)) continue;
        const lote = loteCache.get(`${fincaCodigo}-${loteCodigo}`);
        if (!lote) continue;
        const semanaEmbolse = semanaCache.get(semanaEmbolseCodigo);
        if (!semanaEmbolse) continue;
        const key = `${finca.id}-${lote.id}-${semanaEmbolse.id}`;
        cohortesUnicos.set(key, { fincaId: finca.id, loteId: lote.id, semanaEmbolseId: semanaEmbolse.id });
      }
    }

    if (cohortesUnicos.size > 0) {
      logger.info(`Consultando saldos de ${cohortesUnicos.size} cohortes en lote...`);
      const cohortesArr = Array.from(cohortesUnicos.values());
      const BATCH_SALDO = 500;
      for (let i = 0; i < cohortesArr.length; i += BATCH_SALDO) {
        const batch = cohortesArr.slice(i, i + BATCH_SALDO);
        const saldos = await racimoMovimientoRepository.getSaldosCohortes(batch);
        for (const [key, saldo] of saldos) {
          saldoBDCache.set(key, saldo);
        }
      }
    }

    logger.info(`Iniciando validación de ${rows.length} filas...`);

    for (let i = 0; i < rows.length; i += 1) {
      if (i % logInterval === 0) logger.info(`Validando... ${i}/${rows.length} filas (${Math.round((i / rows.length) * 100)}%)`);
      if (progressToken) bulkProgress.update(progressToken, { pct: Math.round((i / rows.length) * 100), fase: 'validando', filas: i });
      const fila = i + 2;
      const row = rows[i];

      const fincaCodigo = String(row.fincacodigo || '').trim();
      const loteCodigo = String(row.lotecodigo || '').trim();
      let tipo = String(row.tipo || '').trim().toUpperCase();
      if (tipo === 'CORTE') tipo = 'PROCESADO';
      const semanaEmbolseCodigo = String(row.semanaembolsecodigo || '').trim();
      const semanaRegistroCodigo = String(row.semanaregistrocodigo || '').trim() || semanaEmbolseCodigo;
      const motivoNombre = String(row.motivo || '').trim();
      const cantidad = Number(row.cantidad);
      const fecha = String(row.fecha || '').trim();
      const observacion = row.observacion ? String(row.observacion).trim() : undefined;

      if (!fincaCodigo || !loteCodigo || !tipo || !semanaEmbolseCodigo || !fecha || !cantidad) {
        errores.push({
          fila,
          mensaje: 'Faltan columnas requeridas: fincaCodigo, loteCodigo, tipo, semanaEmbolseCodigo, fecha y/o cantidad',
        });
        continue;
      }
      if (!TIPOS_VALIDOS.includes(tipo)) {
        errores.push({ fila, mensaje: `Tipo inválido '${row.tipo}'. Debe ser EMBOLSE, REPIQUE, RECUSE o PROCESADO` });
        continue;
      }
      if (!Number.isInteger(cantidad) || cantidad <= 0) {
        errores.push({ fila, mensaje: 'La cantidad debe ser un número entero mayor que 0' });
        continue;
      }

      try {
        const finca = fincaCache.get(fincaCodigo);
        if (finca === undefined) {
          errores.push({ fila, mensaje: `No existe ninguna finca con código '${fincaCodigo}'` });
          continue;
        }
        if (fincaIdsPermitidas !== null && !fincaIdsPermitidas.includes(finca.id)) {
          errores.push({ fila, mensaje: `No tienes acceso a la finca '${fincaCodigo}'` });
          continue;
        }

        const loteKey = `${fincaCodigo}-${loteCodigo}`;
        const lote = loteCache.get(loteKey);
        if (lote === undefined) {
          errores.push({ fila, mensaje: `No existe el lote '${loteCodigo}' en la finca '${fincaCodigo}'` });
          continue;
        }

        const semanaEmbolse = semanaCache.get(semanaEmbolseCodigo);
        if (semanaEmbolse === undefined) {
          errores.push({ fila, mensaje: `No existe la semana de embolse '${semanaEmbolseCodigo}'` });
          continue;
        }

        const semanaRegistro = semanaCache.get(semanaRegistroCodigo);
        if (semanaRegistro === undefined) {
          errores.push({ fila, mensaje: `No existe la semana de registro '${semanaRegistroCodigo}'` });
          continue;
        }

        if (!puedeSaltarRestriccionSemana) {
          const ultima = ultimaSemanaRegistroPorFinca.get(finca.id);
          if (ultima && semanaRegistro.fechaInicio < ultima.fechaInicio) {
            errores.push({
              fila,
              mensaje: `Solo un administrador (o alguien con permiso de editar histórico) puede cargar movimientos de semanas anteriores a la última semana registrada en esta finca (${ultima.codigo})`,
            });
            continue;
          }
        }

        let motivoRepiqueId = null;
        let motivoRecuseId = null;

        if (tipo === 'REPIQUE') {
          if (!motivoNombre) {
            errores.push({ fila, mensaje: 'El repique requiere la columna motivo' });
            continue;
          }
          const motivo = motivoRepiqueCache.get(motivoNombre);
          if (motivo === undefined) {
            errores.push({
              fila,
              mensaje: `No existe el motivo de repique '${motivoNombre}'. Créalo primero en Maestros → Motivos de Repique`,
            });
            continue;
          }
          motivoRepiqueId = motivo.id;
        } else if (tipo === 'RECUSE') {
          if (!motivoNombre) {
            errores.push({ fila, mensaje: 'El recuse requiere la columna motivo' });
            continue;
          }
          const motivo = motivoRecuseCache.get(motivoNombre);
          if (motivo === undefined) {
            errores.push({
              fila,
              mensaje: `No existe el motivo de recuse '${motivoNombre}'. Créalo primero en Maestros → Motivos de Recuse`,
            });
            continue;
          }
          motivoRecuseId = motivo.id;
        }

        const cohorteKey = `${finca.id}-${lote.id}-${semanaEmbolse.id}`;

        if (tipo !== 'EMBOLSE') {
          const saldoBD = saldoBDCache.has(cohorteKey) ? saldoBDCache.get(cohorteKey) : 0;
          const saldoDisponible = saldoBD + (saldoSimulado.get(cohorteKey) || 0);
          if (cantidad > saldoDisponible) {
            // Solo un administrador puede llegar a forzar esto (ver el
            // permission check en el controller); para todos los demás
            // sigue siendo un error duro que descarta la fila.
            if (esAdmin) {
              warnings.push({
                fila,
                mensaje: `La cantidad (${cantidad}) supera el saldo disponible de esa cohorte (${saldoDisponible})`,
              });
            } else {
              errores.push({
                fila,
                mensaje: `La cantidad (${cantidad}) supera el saldo disponible de esa cohorte (${saldoDisponible})`,
              });
              continue;
            }
          }
        }

        const delta = tipo === 'EMBOLSE' ? cantidad : -cantidad;
        saldoSimulado.set(cohorteKey, (saldoSimulado.get(cohorteKey) || 0) + delta);

        filasValidas.push({ fincaId: finca.id, loteId: lote.id, semanaEmbolseId: semanaEmbolse.id, semanaRegistroId: semanaRegistro.id, tipo, motivoRepiqueId, motivoRecuseId, cantidad, fecha, observacion, createdBy: actorId });
      } catch (error) {
        errores.push({ fila, mensaje: error.message || 'Error al procesar la fila' });
      }
    }

    if (dryRun) {
      if (progressToken) bulkProgress.complete(progressToken, 0, errores);
      return { totalFilas: rows.length, movimientosCreados: 0, errores, warnings };
    }

    // Si hay advertencias de saldo negativo (solo posibles para un admin,
    // ver el filtro esAdmin más arriba) y aún no confirmó, se pide
    // confirmación antes de insertar nada. Esto tiene prioridad sobre
    // mode="auto": aunque el archivo tenga OTROS errores duros sin relación
    // (columnas faltantes, etc.), el admin igual debe poder decidir si
    // fuerza o no las filas de saldo negativo — los errores duros se
    // devuelven junto con las advertencias para que los vea, pero de todas
    // formas nunca se insertan (quedan fuera de filasValidas). Se cachean
    // las filas ya validadas (por progressToken) para que, si confirma, no
    // haga falta volver a subir ni revalidar el archivo completo.
    if (warnings.length > 0 && !forceNegativeSaldos) {
      if (progressToken) {
        bulkValidationCache.set(progressToken, { filasValidas, errores, warnings, totalFilas: rows.length });
        bulkProgress.complete(progressToken, 0, errores);
      }
      return { totalFilas: rows.length, movimientosCreados: 0, errores, warnings, requireConfirmation: true };
    }

    if (mode === 'auto' && errores.length > 0) {
      if (progressToken) bulkProgress.complete(progressToken, 0, errores);
      return { totalFilas: rows.length, movimientosCreados: 0, errores, warnings };
    }

    if (filasValidas.length === 0) {
      if (progressToken) bulkProgress.complete(progressToken, 0, errores);
      return { totalFilas: rows.length, movimientosCreados: 0, errores, warnings };
    }

    return this._insertarYFinalizar(filasValidas, rows.length, errores, warnings, progressToken);
  },

  // Inserta en lotes de 500, actualizando el progreso a medida que avanza.
  // Se usa tanto en la validación normal como al reutilizar una validación
  // ya cacheada (confirmación de saldos negativos), para no duplicar esta
  // lógica.
  //
  // NOTA: con DB_MODE=bridge (túnel HTTP), sequelize.transaction() no
  // garantiza atomicidad real entre lotes — el bridge puede enrutar cada
  // query a un worker distinto sin la transacción activa (bug confirmado).
  // Por eso cada lote se inserta como su propia sentencia (ya atómica por
  // sí sola vía bulkCreate) con reintento ante fallos transitorios del
  // bridge, en vez de envolver todo en una transacción que daría una falsa
  // sensación de todo-o-nada.
  async _insertarYFinalizar(filasValidas, totalFilas, errores, warnings, progressToken) {
    let creados = 0;
    logger.info(`Validación completa. Insertando ${filasValidas.length} filas...`);

    if (progressToken) bulkProgress.update(progressToken, { pct: 50, fase: 'insertando', filas: 0, total: filasValidas.length });

    const actualizarProgreso = (n) => {
      creados = n;
      logger.info(`Insertando... ${creados}/${filasValidas.length} filas`);
      if (progressToken) {
        bulkProgress.update(progressToken, {
          pct: Math.round((creados / filasValidas.length) * 50) + 50,
          fase: 'insertando',
          filas: creados,
        });
      }
    };

    if (env.db.mode === 'bridge' && filasValidas.length > 0) {
      try {
        creados = await insertarViaBridgeBatch(filasValidas, actualizarProgreso);
      } catch (error) {
        // Deja constancia de cuánto sí alcanzó a insertarse antes de fallar
        // definitivamente (cada petición 'batch' es su propia transacción,
        // así que lo de peticiones anteriores ya quedó insertado de verdad).
        throw new Error(`Se insertaron ${creados} de ${filasValidas.length} filas antes de fallar: ${error.message}`);
      }
    } else {
      const BATCH_SIZE = 500;
      for (let i = 0; i < filasValidas.length; i += BATCH_SIZE) {
        const batch = filasValidas.slice(i, i + BATCH_SIZE);
        try {
          await racimoMovimientoRepository.bulkCreate(batch);
        } catch (error) {
          logger.info(`Fallo insertando lote (filas ${creados}-${creados + batch.length}), reintentando: ${error.message}`);
          await new Promise((r) => setTimeout(r, 1500));
          try {
            await racimoMovimientoRepository.bulkCreate(batch);
          } catch (error2) {
            throw new Error(
              `Se insertaron ${creados} de ${filasValidas.length} filas antes de fallar: ${error2.message}`,
            );
          }
        }
        actualizarProgreso(creados + batch.length);
      }
    }

    logger.info(`Cargue completado: ${creados} movimientos creados`);
    if (progressToken) bulkProgress.complete(progressToken, creados, errores);

    return { totalFilas, movimientosCreados: creados, errores, warnings };
  },

  async getReporteSaldos(query, user) {
    const finca = query.fincaUuid ? await findFincaByUuidOrFail(query.fincaUuid) : null;
    if (finca) assertFincaPermitida(user, finca.id);
    // Si pidió una finca puntual, se expande a su Grupo de Finca (ver
    // utils/fincaScope.js); si no, se usa el alcance normal del usuario.
    const fincaIdsFiltro = finca ? await expandirFincaIds([finca.id]) : getFincaIdsPermitidas(user);

    const cantidadSemanas = Number(query.cantidadSemanas) || 13;
    const anioReal = new Date().getFullYear();
    const anio = query.anio ? Number(query.anio) : anioReal;

    // Semana de referencia: si es el año en curso, la semana real de hoy
    // (para que "edad 1" sea la semana actual); si es un año distinto, la
    // última semana registrada de ese año (para ver el cierre de ese año).
    const semanaActual =
      anio === anioReal
        ? await semanaRepository.findByFecha(new Date().toISOString().slice(0, 10))
        : await semanaRepository.findUltimaDelAnio(anio);
    if (!semanaActual) throw ApiError.notFound(`No hay semanas registradas para el año ${anio}`);

    // Últimas N semanas (incluida la de referencia), ordenadas de más antigua a más reciente
    const semanasEmbolse = await semanaRepository.findUltimasN(semanaActual.id, cantidadSemanas);
    const semanaEmbolseIds = semanasEmbolse.map((s) => s.id);

    // Una sola consulta: todos los movimientos de esas cohortes (de una
    // finca puntual, o de todas si no se filtra ninguna)
    const movimientos = await racimoMovimientoRepository.findConFincaYLote({
      semanaEmbolseIds,
      fincaIds: fincaIdsFiltro,
    });

    // Invertir orden: semana actual primero (izquierda), más antigua al final (derecha)
    semanasEmbolse.reverse();

    const porCohorte = Object.fromEntries(semanasEmbolse.map((s) => [s.id, { totalEmbolsado: 0, totalRepicado: 0, totalRecusado: 0, totalProcesado: 0 }]));
    const porLoteYCohorte = {}; // key: "loteId-semanaEmbolseId"

    for (const m of movimientos) {
      const c = porCohorte[m.semanaEmbolseId];
      if (!c) continue;

      if (m.tipo === 'EMBOLSE') c.totalEmbolsado += m.cantidad;
      else if (m.tipo === 'REPIQUE') c.totalRepicado += m.cantidad;
      else if (m.tipo === 'RECUSE') c.totalRecusado += m.cantidad;
      else if (m.tipo === 'PROCESADO') c.totalProcesado += m.cantidad;

      const loteKey = `${m.loteId}-${m.semanaEmbolseId}`;
      if (!porLoteYCohorte[loteKey]) porLoteYCohorte[loteKey] = 0;
      porLoteYCohorte[loteKey] += m.tipo === 'EMBOLSE' ? m.cantidad : -m.cantidad;
    }

    // El desglose por lote solo tiene sentido cuando se filtra una finca:
    // "todas las fincas" mezclaría lotes con el mismo código de fincas
    // distintas, así que en ese caso solo se muestran los totales.
    const todosLosLotes = finca
      ? await Lote.findAll({
          where: { fincaId: { [Op.in]: fincaIdsFiltro } },
          attributes: ['id', 'uuid', 'codigo', 'nombre'],
          order: [['codigo', 'ASC']],
        })
      : [];

    // Construir columnas de cohortes
    const cohortes = semanasEmbolse.map((semana) => {
      const c = porCohorte[semana.id];
      const diffMs = new Date(semanaActual.fechaInicio) - new Date(semana.fechaInicio);
      const edadSemanas = Math.round(diffMs / (7 * 86400000)) + 1;
      return {
        semanaUuid: semana.uuid,
        semanaCodigo: semana.codigo,
        anio: semana.anio,
        numeroSemana: semana.numeroSemana,
        color: semana.color,
        edadSemanas,
        totalEmbolsado: c.totalEmbolsado,
        totalRepicado: c.totalRepicado,
        totalRecusado: c.totalRecusado,
        totalProcesado: c.totalProcesado,
        saldo: c.totalEmbolsado - c.totalRepicado - c.totalRecusado - c.totalProcesado,
      };
    });

    // Construir filas de lotes (solo saldo por cohorte), keyed por uuid
    const lotes = todosLosLotes.map((lote) => {
      const saldos = {};
      for (const s of semanasEmbolse) {
        const key = `${lote.id}-${s.id}`;
        saldos[s.uuid] = porLoteYCohorte[key] || 0;
      }
      return {
        uuid: lote.uuid,
        codigo: lote.codigo,
        nombre: lote.nombre,
        saldos,
      };
    });

    // Totales finales por cohorte, keyed por uuid
    const saldosFinales = {};
    for (const s of semanasEmbolse) {
      const c = porCohorte[s.id];
      saldosFinales[s.uuid] = c.totalEmbolsado - c.totalRepicado - c.totalRecusado - c.totalProcesado;
    }

    return {
      finca: finca ? { uuid: finca.uuid, codigo: finca.codigo, nombre: finca.nombre } : null,
      semanaActual: { uuid: semanaActual.uuid, codigo: semanaActual.codigo, anio: semanaActual.anio, numeroSemana: semanaActual.numeroSemana },
      cohortes,
      lotes,
      saldosFinales,
    };
  },

  // Total embolsado por semana de un año completo, para el gráfico de
  // líneas de embolses (general o por finca).
  async getReporteEmbolses(query, user) {
    const finca = query.fincaUuid ? await findFincaByUuidOrFail(query.fincaUuid) : null;
    if (finca) assertFincaPermitida(user, finca.id);
    const fincaIdsFiltro = finca ? await expandirFincaIds([finca.id]) : getFincaIdsPermitidas(user);
    const hoy = new Date();

    const anios = query.anios
      ? query.anios.split(',').map(Number).filter(Boolean)
      : [query.anio ? Number(query.anio) : hoy.getFullYear()];

    const resultados = await Promise.all(
      anios.map(async (anio) => {
        const semanas = await semanaRepository.findAllByAnio(anio);
        if (semanas.length === 0) return null;

        const totalesPorSemana = await racimoMovimientoRepository.getEmbolsePorSemana({
          semanaIds: semanas.map((s) => s.id),
          fincaIds: fincaIdsFiltro,
        });

        const puntos = semanas.map((s) => {
          const total = totalesPorSemana.get(s.id);
          return {
            numeroSemana: s.numeroSemana,
            totalEmbolsado: total ?? null,
            codigo: s.codigo,
            color: s.color,
            fechaInicio: s.fechaInicio,
          };
        });

        return {
          anio,
          totalAnual: puntos.reduce((acc, p) => acc + (p.totalEmbolsado || 0), 0),
          puntos,
        };
      }),
    );

    const aniosValidos = resultados.filter(Boolean);
    if (aniosValidos.length === 0) {
      throw ApiError.notFound(`No hay semanas registradas para los años solicitados`);
    }

    return {
      finca: finca ? { uuid: finca.uuid, codigo: finca.codigo, nombre: finca.nombre } : null,
      anios: aniosValidos,
    };
  },

  // Requiere el permiso racimo_movimiento.eliminar (ya lo exige la ruta).
  // Además, un usuario no-administrador solo puede borrar movimientos de la
  // última semana de registro de esa finca (o más reciente) — misma regla
  // que ya aplica a crear, para no tocar el histórico ya cerrado. El
  // administrador puede borrar cualquier movimiento, de cualquier semana.
  async deleteMovimiento(uuid, actorId, user) {
    const movimiento = await this.getMovimientoByUuid(uuid, user);

    if (!puedeIgnorarRestriccionSemana(user)) {
      const ultimaPorFinca = await racimoMovimientoRepository.getUltimaSemanaRegistroPorFinca([movimiento.fincaId]);
      const ultima = ultimaPorFinca.get(movimiento.fincaId);
      if (ultima && movimiento.semanaRegistro.fechaInicio < ultima.fechaInicio) {
        throw ApiError.forbidden(
          `Solo un administrador (o alguien con permiso de editar histórico) puede eliminar movimientos de semanas anteriores a la última semana registrada en esta finca (${ultima.codigo})`,
        );
      }
    }

    await racimoMovimientoRepository.softDelete(movimiento, actorId);
  },

  // Inventario por cohorte (finca + lote + semana de embolse): totales de
  // cada tipo de movimiento y saldo vigente, para las últimas
  // `cantidadSemanas` semanas de embolse contando desde `semanaActual`.
  async getInventario(query, user) {
    const fincaId = query.fincaUuid ? (await findFincaByUuidOrFail(query.fincaUuid)).id : undefined;
    if (fincaId) assertFincaPermitida(user, fincaId);
    const fincaIds = fincaId ? await expandirFincaIds([fincaId]) : getFincaIdsPermitidas(user);
    const loteId = query.loteUuid ? (await findLoteByUuidOrFail(query.loteUuid)).id : undefined;

    const semanaActual = query.semanaActualUuid
      ? await findSemanaByUuidOrFail(query.semanaActualUuid)
      : await semanaRepository.findByFecha(new Date().toISOString().slice(0, 10));
    if (!semanaActual) throw ApiError.notFound('No hay una semana registrada para la fecha actual');

    const cantidadSemanas = query.cantidadSemanas ? Number(query.cantidadSemanas) : 12;
    const semanasEmbolse = await semanaRepository.findUltimasN(semanaActual.id, cantidadSemanas);
    const semanaEmbolseIds = semanasEmbolse.map((s) => s.id);

    const movimientos = await racimoMovimientoRepository.findMovimientosParaInventario({
      fincaIds,
      loteId,
      semanaEmbolseIds,
    });

    const cohortes = new Map();
    for (const m of movimientos) {
      const key = `${m.fincaId}-${m.loteId}-${m.semanaEmbolseId}`;
      if (!cohortes.has(key)) {
        cohortes.set(key, {
          finca: m.finca,
          lote: m.lote,
          semanaEmbolseId: m.semanaEmbolseId,
          totalEmbolsado: 0,
          totalRepicado: 0,
          totalRecusado: 0,
          totalProcesado: 0,
        });
      }
      const c = cohortes.get(key);
      if (m.tipo === 'EMBOLSE') c.totalEmbolsado += m.cantidad;
      else if (m.tipo === 'REPIQUE') c.totalRepicado += m.cantidad;
      else if (m.tipo === 'RECUSE') c.totalRecusado += m.cantidad;
      else if (m.tipo === 'PROCESADO') c.totalProcesado += m.cantidad;
    }

    const semanaPorId = new Map(semanasEmbolse.map((s) => [s.id, s]));
    const items = Array.from(cohortes.values()).map((c) => {
      const semana = semanaPorId.get(c.semanaEmbolseId);
      const edadSemanas =
        Math.round((new Date(semanaActual.fechaInicio) - new Date(semana.fechaInicio)) / (7 * 86400000)) + 1;
      return {
        finca: c.finca,
        lote: c.lote,
        semanaEmbolse: {
          uuid: semana.uuid,
          codigo: semana.codigo,
          anio: semana.anio,
          numeroSemana: semana.numeroSemana,
          color: semana.color,
        },
        edadSemanas,
        totalEmbolsado: c.totalEmbolsado,
        totalRepicado: c.totalRepicado,
        totalRecusado: c.totalRecusado,
        totalProcesado: c.totalProcesado,
        saldo: c.totalEmbolsado - c.totalRepicado - c.totalRecusado - c.totalProcesado,
      };
    });

    return {
      semanaActual: {
        uuid: semanaActual.uuid,
        codigo: semanaActual.codigo,
        anio: semanaActual.anio,
        numeroSemana: semanaActual.numeroSemana,
        color: semanaActual.color || calcularColorSemana(semanaActual.anio, semanaActual.numeroSemana),
      },
      semanasEmbolse: semanasEmbolse.map((s) => ({
        uuid: s.uuid,
        codigo: s.codigo,
        anio: s.anio,
        numeroSemana: s.numeroSemana,
        color: s.color,
      })),
      items,
    };
  },
};

export default racimoMovimientoService;
