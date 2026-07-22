import { sequelize } from '../../database/connection.js';
import { infeccionRepository } from '../../repositories/agricola/infeccion.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { findEvaluacionByUuidOrFail } from './evaluacionLookup.js';

export const infeccionService = {
  async getInfeccionByEvaluacionUuid(evaluacionUuid, user) {
    const evaluacion = await findEvaluacionByUuidOrFail(evaluacionUuid, user);
    const infeccion = await infeccionRepository.findByEvaluacionId(evaluacion.id);
    if (!infeccion) throw ApiError.notFound('La evaluación no tiene infección registrada');
    return infeccion;
  },

  async createInfeccion(evaluacionUuid, payload, actorId, user) {
    const evaluacion = await findEvaluacionByUuidOrFail(evaluacionUuid, user);

    const existing = await infeccionRepository.findByEvaluacionId(evaluacion.id);
    if (existing) throw ApiError.conflict('Esta evaluación ya tiene una infección registrada');

    return sequelize.transaction(async (transaction) => {
      const infeccion = await infeccionRepository.create(
        {
          evaluacionId: evaluacion.id,
          hojasTotales: payload.hojasTotales,
          yli: payload.yli,
          yls: payload.yls,
          estado: true,
          createdBy: actorId,
        },
        { transaction },
      );

      if (payload.hojas?.length) {
        await infeccionRepository.createHojas(
          payload.hojas.map((hoja) => ({
            infeccionId: infeccion.id,
            numeroHoja: hoja.numeroHoja,
            severidad: hoja.severidad,
            createdBy: actorId,
          })),
          { transaction },
        );
      }

      return infeccionRepository.findByEvaluacionId(evaluacion.id, { transaction });
    });
  },

  async updateInfeccion(evaluacionUuid, payload, actorId, user) {
    const evaluacion = await findEvaluacionByUuidOrFail(evaluacionUuid, user);
    const infeccion = await infeccionRepository.findByEvaluacionId(evaluacion.id);
    if (!infeccion) throw ApiError.notFound('La evaluación no tiene infección registrada');

    return sequelize.transaction(async (transaction) => {
      const data = { updatedBy: actorId };
      if (payload.hojasTotales !== undefined) data.hojasTotales = payload.hojasTotales;
      if (payload.yli !== undefined) data.yli = payload.yli;
      if (payload.yls !== undefined) data.yls = payload.yls;
      if (payload.estado !== undefined) data.estado = payload.estado;

      await infeccionRepository.update(infeccion, data, { transaction });

      if (payload.hojas) {
        await infeccionRepository.replaceHojas(
          infeccion.id,
          payload.hojas.map((hoja) => ({
            infeccionId: infeccion.id,
            numeroHoja: hoja.numeroHoja,
            severidad: hoja.severidad,
            createdBy: actorId,
          })),
          { transaction },
        );
      }

      return infeccionRepository.findByEvaluacionId(evaluacion.id, { transaction });
    });
  },
};

export default infeccionService;
