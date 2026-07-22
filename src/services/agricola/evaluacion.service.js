import { sequelize } from '../../database/connection.js';
import { Planta, User, TipoEvaluacion, Semana, Finca, Lote } from '../../database/associations.js';
import { evaluacionRepository } from '../../repositories/agricola/evaluacion.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { getFincaIdsPermitidas, assertFincaPermitida } from '../../utils/fincaScope.js';

const findPlantaByUuidOrFail = async (uuid) => {
  const planta = await Planta.findOne({ where: { uuid } });
  if (!planta) throw ApiError.notFound('Planta no encontrada');
  return planta;
};

// Igual que findPlantaByUuidOrFail, pero trayendo el loteId de una para
// poder validar la finca del usuario sin otra consulta.
const findPlantaConLoteByUuidOrFail = async (uuid) => {
  const planta = await Planta.findOne({ where: { uuid }, include: [{ model: Lote, as: 'lote', attributes: ['id', 'fincaId'] }] });
  if (!planta) throw ApiError.notFound('Planta no encontrada');
  return planta;
};

const findTipoEvaluacionByUuidOrFail = async (uuid) => {
  const tipo = await TipoEvaluacion.findOne({ where: { uuid } });
  if (!tipo) throw ApiError.notFound('Tipo de evaluación no encontrado');
  return tipo;
};

const findSemanaByUuidOrFail = async (uuid) => {
  const semana = await Semana.findOne({ where: { uuid } });
  if (!semana) throw ApiError.notFound('Semana no encontrada');
  return semana;
};

const findUsuarioByUuidOrFail = async (uuid) => {
  const usuario = await User.findOne({ where: { uuid } });
  if (!usuario) throw ApiError.notFound('Usuario evaluador no encontrado');
  return usuario;
};

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

export const evaluacionService = {
  async listEvaluaciones(query, user) {
    const { page, limit, offset } = getPagination(query);

    const fincaId = query.fincaUuid ? (await findFincaByUuidOrFail(query.fincaUuid)).id : undefined;
    if (fincaId) assertFincaPermitida(user, fincaId);
    const loteId = query.loteUuid ? (await findLoteByUuidOrFail(query.loteUuid)).id : undefined;
    const tipoEvaluacionId = query.tipoEvaluacionUuid
      ? (await findTipoEvaluacionByUuidOrFail(query.tipoEvaluacionUuid)).id
      : undefined;

    const { rows, count } = await evaluacionRepository.findAndCountAll({
      limit,
      offset,
      fechaDesde: query.fechaDesde,
      fechaHasta: query.fechaHasta,
      fincaId,
      fincaIds: getFincaIdsPermitidas(user),
      loteId,
      tipoEvaluacionId,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getEvaluacionByUuid(uuid, user) {
    const evaluacion = await evaluacionRepository.findByUuid(uuid, { fincaIds: getFincaIdsPermitidas(user) });
    if (!evaluacion) throw ApiError.notFound('Evaluación no encontrada');
    return evaluacion;
  },

  async createEvaluacion(payload, actorId, user) {
    const plantaConLote = await findPlantaConLoteByUuidOrFail(payload.plantaUuid);
    assertFincaPermitida(user, plantaConLote.lote?.fincaId);
    const planta = plantaConLote;
    const tipoEvaluacion = await findTipoEvaluacionByUuidOrFail(payload.tipoEvaluacionUuid);
    const semana = await findSemanaByUuidOrFail(payload.semanaUuid);
    const usuario = payload.usuarioUuid
      ? await findUsuarioByUuidOrFail(payload.usuarioUuid)
      : { id: actorId };

    return sequelize.transaction((transaction) =>
      evaluacionRepository.create(
        {
          plantaId: planta.id,
          usuarioId: usuario.id,
          tipoEvaluacionId: tipoEvaluacion.id,
          semanaId: semana.id,
          fecha: payload.fecha,
          observacion: payload.observacion,
          estado: payload.estado ?? true,
          createdBy: actorId,
        },
        { transaction },
      ),
    );
  },

  async updateEvaluacion(uuid, payload, actorId, user) {
    const evaluacion = await this.getEvaluacionByUuid(uuid, user);
    const data = { updatedBy: actorId };

    if (payload.plantaUuid) {
      const plantaConLote = await findPlantaConLoteByUuidOrFail(payload.plantaUuid);
      assertFincaPermitida(user, plantaConLote.lote?.fincaId);
      data.plantaId = plantaConLote.id;
    }
    if (payload.tipoEvaluacionUuid) {
      data.tipoEvaluacionId = (await findTipoEvaluacionByUuidOrFail(payload.tipoEvaluacionUuid)).id;
    }
    if (payload.semanaUuid) data.semanaId = (await findSemanaByUuidOrFail(payload.semanaUuid)).id;
    if (payload.usuarioUuid) data.usuarioId = (await findUsuarioByUuidOrFail(payload.usuarioUuid)).id;
    if (payload.fecha !== undefined) data.fecha = payload.fecha;
    if (payload.observacion !== undefined) data.observacion = payload.observacion;
    if (payload.estado !== undefined) data.estado = payload.estado;

    return evaluacionRepository.update(evaluacion, data);
  },

  async deleteEvaluacion(uuid, actorId, user) {
    const evaluacion = await this.getEvaluacionByUuid(uuid, user);
    await evaluacionRepository.softDelete(evaluacion, actorId);
  },
};

export default evaluacionService;
