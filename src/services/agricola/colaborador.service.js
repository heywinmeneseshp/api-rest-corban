import { colaboradorRepository } from '../../repositories/agricola/colaborador.repository.js';
import { laborRepository } from '../../repositories/agricola/labor.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { Finca } from '../../database/associations.js';
import { sequelize } from '../../database/connection.js';

const CALIFICACION_MIN = 1;
const CALIFICACION_MAX = 5;

const findFincaOrFail = async (uuid) => {
  const finca = await Finca.findOne({ where: { uuid } });
  if (!finca) throw ApiError.notFound('Finca no encontrada');
  return finca;
};

// Resuelve cada { laborUuid, calificacion } a { laborId, calificacion },
// validando que la labor exista y que la calificación esté en rango — se
// hace una vez acá para no repetir la validación en create/update.
const resolverLabores = async (labores = []) => {
  const resueltas = [];
  for (const item of labores) {
    if (item.calificacion < CALIFICACION_MIN || item.calificacion > CALIFICACION_MAX) {
      throw ApiError.badRequest(`La calificación debe estar entre ${CALIFICACION_MIN} y ${CALIFICACION_MAX}`);
    }
    const labor = await laborRepository.findByUuid(item.laborUuid);
    if (!labor) throw ApiError.notFound(`Labor no encontrada: ${item.laborUuid}`);
    resueltas.push({ laborId: labor.id, calificacion: item.calificacion });
  }
  const laborIds = resueltas.map((r) => r.laborId);
  if (new Set(laborIds).size !== laborIds.length) {
    throw ApiError.badRequest('No se puede calificar la misma labor más de una vez');
  }
  return resueltas;
};

export const colaboradorService = {
  async listColaboradores(query) {
    const { page, limit, offset } = getPagination(query);
    const fincaId = query.fincaUuid ? (await findFincaOrFail(query.fincaUuid)).id : undefined;
    const estado = query.estado !== undefined ? query.estado === 'true' || query.estado === true : undefined;

    const { rows, count } = await colaboradorRepository.findAndCountAll({
      limit,
      offset,
      search: query.search,
      fincaId,
      estado,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getColaboradorByUuid(uuid) {
    const colaborador = await colaboradorRepository.findByUuid(uuid);
    if (!colaborador) throw ApiError.notFound('Colaborador no encontrado');
    return colaborador;
  },

  async createColaborador(payload, actorId) {
    const fincaId = payload.fincaUuid ? (await findFincaOrFail(payload.fincaUuid)).id : null;
    const labores = await resolverLabores(payload.labores);

    return sequelize.transaction(async (transaction) => {
      const colaborador = await colaboradorRepository.create(
        {
          nombre: payload.nombre,
          documento: payload.documento || null,
          telefono: payload.telefono || null,
          fincaId,
          estado: payload.estado ?? true,
          createdBy: actorId,
        },
        { transaction },
      );

      if (labores.length) {
        await colaboradorRepository.replaceLabores(colaborador.id, labores, actorId, { transaction });
      }

      return colaboradorRepository.findByUuid(colaborador.uuid, { transaction });
    });
  },

  async updateColaborador(uuid, payload, actorId) {
    const colaborador = await this.getColaboradorByUuid(uuid);

    const data = { updatedBy: actorId };
    if (payload.nombre !== undefined) data.nombre = payload.nombre;
    if (payload.documento !== undefined) data.documento = payload.documento || null;
    if (payload.telefono !== undefined) data.telefono = payload.telefono || null;
    if (payload.estado !== undefined) data.estado = payload.estado;
    if (payload.fincaUuid !== undefined) {
      data.fincaId = payload.fincaUuid ? (await findFincaOrFail(payload.fincaUuid)).id : null;
    }

    const labores = payload.labores !== undefined ? await resolverLabores(payload.labores) : undefined;

    return sequelize.transaction(async (transaction) => {
      await colaboradorRepository.update(colaborador, data, { transaction });
      if (labores !== undefined) {
        await colaboradorRepository.replaceLabores(colaborador.id, labores, actorId, { transaction });
      }
      return colaboradorRepository.findByUuid(uuid, { transaction });
    });
  },

  async deleteColaborador(uuid, actorId) {
    const colaborador = await this.getColaboradorByUuid(uuid);
    await colaboradorRepository.softDelete(colaborador, actorId);
  },
};

export default colaboradorService;
