import { sequelize } from '../../database/connection.js';
import { Planta, User, TipoEvaluacion, Semana } from '../../database/associations.js';
import { evaluacionRepository } from '../../repositories/agricola/evaluacion.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';

const findPlantaByUuidOrFail = async (uuid) => {
  const planta = await Planta.findOne({ where: { uuid } });
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

export const evaluacionService = {
  async listEvaluaciones(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await evaluacionRepository.findAndCountAll({
      limit,
      offset,
      fechaDesde: query.fechaDesde,
      fechaHasta: query.fechaHasta,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getEvaluacionByUuid(uuid) {
    const evaluacion = await evaluacionRepository.findByUuid(uuid);
    if (!evaluacion) throw ApiError.notFound('Evaluación no encontrada');
    return evaluacion;
  },

  async createEvaluacion(payload, actorId) {
    const planta = await findPlantaByUuidOrFail(payload.plantaUuid);
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

  async updateEvaluacion(uuid, payload, actorId) {
    const evaluacion = await this.getEvaluacionByUuid(uuid);
    const data = { updatedBy: actorId };

    if (payload.plantaUuid) data.plantaId = (await findPlantaByUuidOrFail(payload.plantaUuid)).id;
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

  async deleteEvaluacion(uuid, actorId) {
    const evaluacion = await this.getEvaluacionByUuid(uuid);
    await evaluacionRepository.softDelete(evaluacion, actorId);
  },
};

export default evaluacionService;
