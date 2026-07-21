import { sequelize } from '../../database/connection.js';
import { Finca, Lote, Semana, MotivoRepique, MotivoRecuse } from '../../database/associations.js';
import { racimoMovimientoRepository } from '../../repositories/agricola/racimoMovimiento.repository.js';
import { semanaRepository } from '../../repositories/agricola/semana.repository.js';
import { fincaRepository } from '../../repositories/agricola/finca.repository.js';
import { loteRepository } from '../../repositories/agricola/lote.repository.js';
import { motivoRepiqueRepository } from '../../repositories/agricola/motivoRepique.repository.js';
import { motivoRecuseRepository } from '../../repositories/agricola/motivoRecuse.repository.js';
import { calcularColorSemana } from '../../utils/semanaColor.js';
import { parseBulkFile } from '../../utils/bulkFileParser.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { logger } from '../../utils/logger.js';
import { bulkProgress } from '../../utils/bulkProgress.js';

const TIPOS_VALIDOS = ['EMBOLSE', 'REPIQUE', 'RECUSE', 'PROCESADO'];

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
  async listMovimientos(query) {
    const { page, limit, offset } = getPagination(query);

    const fincaId = query.fincaUuid ? (await findFincaByUuidOrFail(query.fincaUuid)).id : undefined;
    const loteId = query.loteUuid ? (await findLoteByUuidOrFail(query.loteUuid)).id : undefined;
    const semanaEmbolseId = query.semanaEmbolseUuid
      ? (await findSemanaByUuidOrFail(query.semanaEmbolseUuid)).id
      : undefined;
    const semanaRegistroId = query.semanaRegistroUuid
      ? (await findSemanaByUuidOrFail(query.semanaRegistroUuid)).id
      : undefined;

    // Rango de semanas de registro: se traduce al rango de fechas que cubren
    // esas semanas (de lunes de la primera a domingo de la última).
    let fechaDesde = query.fechaDesde;
    let fechaHasta = query.fechaHasta;
    if (query.semanaRegistroDesdeUuid) {
      fechaDesde = (await findSemanaByUuidOrFail(query.semanaRegistroDesdeUuid)).fechaInicio;
    }
    if (query.semanaRegistroHastaUuid) {
      fechaHasta = (await findSemanaByUuidOrFail(query.semanaRegistroHastaUuid)).fechaFin;
    }

    const { rows, count } = await racimoMovimientoRepository.findAndCountAll({
      limit,
      offset,
      fincaId,
      loteId,
      semanaEmbolseId,
      semanaRegistroId,
      tipo: query.tipo,
      fechaDesde,
      fechaHasta,
    });

    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getMovimientoByUuid(uuid) {
    const movimiento = await racimoMovimientoRepository.findByUuid(uuid);
    if (!movimiento) throw ApiError.notFound('Movimiento de racimos no encontrado');
    return movimiento;
  },

  // Resumen de una cohorte puntual (finca + lote + semana de embolse):
  // totales por tipo y saldo disponible, para mostrar antes de registrar
  // un nuevo movimiento sobre esa cohorte.
  async getResumenCohorte(query) {
    const finca = await findFincaByUuidOrFail(query.fincaUuid);
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

  async createMovimiento(payload, actorId) {
    const finca = await findFincaByUuidOrFail(payload.fincaUuid);
    const lote = await findLoteByUuidOrFail(payload.loteUuid);
    const semanaEmbolse = await findSemanaByUuidOrFail(payload.semanaEmbolseUuid);
    const semanaRegistro = payload.semanaRegistroUuid
      ? await findSemanaByUuidOrFail(payload.semanaRegistroUuid)
      : semanaEmbolse;

    const { motivoRepiqueId, motivoRecuseId } = await resolveMotivos(payload.tipo, payload);

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
  async bulkCreateMovimientos(file, actorId, { dryRun = false, mode, progressToken } = {}) {
    const rows = parseBulkFile(file);
    if (rows.length === 0) throw ApiError.badRequest('El archivo no tiene filas para procesar');

    if (progressToken) bulkProgress.init(progressToken, rows.length);

    const fincaCache = new Map();
    const loteCache = new Map();
    const semanaCache = new Map();
    const motivoRepiqueCache = new Map();
    const motivoRecuseCache = new Map();
    const saldoSimulado = new Map();
    const saldoBDCache = new Map();
    const filasValidas = [];

    let creados = 0;
    const errores = [];
    const logInterval = Math.max(1, Math.floor(rows.length / 20));

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
        let finca = fincaCache.get(fincaCodigo);
        if (finca === undefined) {
          finca = await fincaRepository.findByCodigo(fincaCodigo);
          fincaCache.set(fincaCodigo, finca);
        }
        if (!finca) {
          errores.push({ fila, mensaje: `No existe ninguna finca con código '${fincaCodigo}'` });
          continue;
        }

        const loteKey = `${fincaCodigo}-${loteCodigo}`;
        let lote = loteCache.get(loteKey);
        if (lote === undefined) {
          lote = await loteRepository.findByFincaAndCodigo(finca.id, loteCodigo);
          loteCache.set(loteKey, lote);
        }
        if (!lote) {
          errores.push({ fila, mensaje: `No existe el lote '${loteCodigo}' en la finca '${fincaCodigo}'` });
          continue;
        }

        let semanaEmbolse = semanaCache.get(semanaEmbolseCodigo);
        if (semanaEmbolse === undefined) {
          semanaEmbolse = await semanaRepository.findByCodigo(semanaEmbolseCodigo);
          semanaCache.set(semanaEmbolseCodigo, semanaEmbolse);
        }
        if (!semanaEmbolse) {
          errores.push({ fila, mensaje: `No existe la semana de embolse '${semanaEmbolseCodigo}'` });
          continue;
        }

        let semanaRegistro = semanaCache.get(semanaRegistroCodigo);
        if (semanaRegistro === undefined) {
          semanaRegistro = await semanaRepository.findByCodigo(semanaRegistroCodigo);
          semanaCache.set(semanaRegistroCodigo, semanaRegistro);
        }
        if (!semanaRegistro) {
          errores.push({ fila, mensaje: `No existe la semana de registro '${semanaRegistroCodigo}'` });
          continue;
        }

        let motivoRepiqueId = null;
        let motivoRecuseId = null;

        if (tipo === 'REPIQUE') {
          if (!motivoNombre) {
            errores.push({ fila, mensaje: 'El repique requiere la columna motivo' });
            continue;
          }
          let motivo = motivoRepiqueCache.get(motivoNombre);
          if (motivo === undefined) {
            motivo = await motivoRepiqueRepository.findByNombre(motivoNombre);
            motivoRepiqueCache.set(motivoNombre, motivo);
          }
          if (!motivo) {
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
          let motivo = motivoRecuseCache.get(motivoNombre);
          if (motivo === undefined) {
            motivo = await motivoRecuseRepository.findByNombre(motivoNombre);
            motivoRecuseCache.set(motivoNombre, motivo);
          }
          if (!motivo) {
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
          if (!saldoBDCache.has(cohorteKey)) {
            const saldoBD = await racimoMovimientoRepository.getSaldoCohorte({
              fincaId: finca.id,
              loteId: lote.id,
              semanaEmbolseId: semanaEmbolse.id,
            });
            saldoBDCache.set(cohorteKey, saldoBD);
          }
          const saldoDisponible = saldoBDCache.get(cohorteKey) + (saldoSimulado.get(cohorteKey) || 0);
          if (cantidad > saldoDisponible) {
            errores.push({
              fila,
              mensaje: `La cantidad (${cantidad}) supera el saldo disponible de esa cohorte (${saldoDisponible})`,
            });
            continue;
          }
        }

        const delta = tipo === 'EMBOLSE' ? cantidad : -cantidad;
        saldoSimulado.set(cohorteKey, (saldoSimulado.get(cohorteKey) || 0) + delta);

        filasValidas.push({ fincaId: finca.id, loteId: lote.id, semanaEmbolseId: semanaEmbolse.id, semanaRegistroId: semanaRegistro.id, tipo, motivoRepiqueId, motivoRecuseId, cantidad, fecha, observacion, createdBy: actorId });
      } catch (error) {
        errores.push({ fila, mensaje: error.message || 'Error al procesar la fila' });
      }
    }

    if (dryRun || (mode === 'auto' && errores.length > 0)) {
      if (progressToken) {
        if (errores.length > 0) bulkProgress.complete(progressToken, 0, errores);
        else bulkProgress.complete(progressToken, 0, []);
      }
      return { totalFilas: rows.length, movimientosCreados: 0, errores };
    }

    if (filasValidas.length === 0) {
      if (progressToken) bulkProgress.complete(progressToken, 0, errores);
      return { totalFilas: rows.length, movimientosCreados: 0, errores };
    }

    logger.info(`Validación completa. Insertando ${filasValidas.length} filas en una transacción...`);

    if (progressToken) bulkProgress.update(progressToken, { pct: 50, fase: 'insertando', filas: 0, total: filasValidas.length });

    const BATCH_SIZE = 500;
    await sequelize.transaction(async (transaction) => {
      for (let i = 0; i < filasValidas.length; i += BATCH_SIZE) {
        const batch = filasValidas.slice(i, i + BATCH_SIZE);
        await racimoMovimientoRepository.bulkCreate(batch, { transaction });
        creados += batch.length;
        logger.info(`Insertando... ${Math.min(i + BATCH_SIZE, filasValidas.length)}/${filasValidas.length} filas`);
        if (progressToken) bulkProgress.update(progressToken, { pct: Math.round((creados / filasValidas.length) * 50) + 50, fase: 'insertando', filas: creados });
      }
    });

    logger.info(`Cargue completado: ${creados} movimientos creados`);
    if (progressToken) bulkProgress.complete(progressToken, creados, errores);

    return { totalFilas: rows.length, movimientosCreados: creados, errores };
  },

  async getReporteSaldos(query) {
    const finca = query.fincaUuid ? await findFincaByUuidOrFail(query.fincaUuid) : null;

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
      fincaId: finca?.id,
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
          where: { fincaId: finca.id },
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

  async deleteMovimiento(uuid, actorId) {
    const movimiento = await this.getMovimientoByUuid(uuid);
    await racimoMovimientoRepository.softDelete(movimiento, actorId);
  },

  // Inventario por cohorte (finca + lote + semana de embolse): totales de
  // cada tipo de movimiento y saldo vigente, para las últimas
  // `cantidadSemanas` semanas de embolse contando desde `semanaActual`.
  async getInventario(query) {
    const fincaId = query.fincaUuid ? (await findFincaByUuidOrFail(query.fincaUuid)).id : undefined;
    const loteId = query.loteUuid ? (await findLoteByUuidOrFail(query.loteUuid)).id : undefined;

    const semanaActual = query.semanaActualUuid
      ? await findSemanaByUuidOrFail(query.semanaActualUuid)
      : await semanaRepository.findByFecha(new Date().toISOString().slice(0, 10));
    if (!semanaActual) throw ApiError.notFound('No hay una semana registrada para la fecha actual');

    const cantidadSemanas = query.cantidadSemanas ? Number(query.cantidadSemanas) : 12;
    const semanasEmbolse = await semanaRepository.findUltimasN(semanaActual.id, cantidadSemanas);
    const semanaEmbolseIds = semanasEmbolse.map((s) => s.id);

    const movimientos = await racimoMovimientoRepository.findMovimientosParaInventario({
      fincaId,
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
