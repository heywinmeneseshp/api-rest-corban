import { sequelize } from '../../database/connection.js';
import { Finca, Lote, Semana, MotivoRepique, MotivoRecuse } from '../../database/associations.js';
import { racimoMovimientoRepository } from '../../repositories/agricola/racimoMovimiento.repository.js';
import { semanaRepository } from '../../repositories/agricola/semana.repository.js';
import { calcularColorSemana } from '../../utils/semanaColor.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';

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

// Valida coherencia tipo <-> motivo: EMBOLSE y CORTE no llevan motivo;
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

    const { rows, count } = await racimoMovimientoRepository.findAndCountAll({
      limit,
      offset,
      fincaId,
      loteId,
      semanaEmbolseId,
      tipo: query.tipo,
      fechaDesde: query.fechaDesde,
      fechaHasta: query.fechaHasta,
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
      else if (m.tipo === 'CORTE') c.totalProcesado += m.cantidad;
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
