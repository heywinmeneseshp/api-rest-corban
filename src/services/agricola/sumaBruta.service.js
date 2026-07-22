import { sequelize } from '../../database/connection.js';
import { sumaBrutaRepository } from '../../repositories/agricola/sumaBruta.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { findEvaluacionByUuidOrFail } from './evaluacionLookup.js';

export const sumaBrutaService = {
  async getSumaBrutaByEvaluacionUuid(evaluacionUuid, user) {
    const evaluacion = await findEvaluacionByUuidOrFail(evaluacionUuid, user);
    const sumaBruta = await sumaBrutaRepository.findByEvaluacionId(evaluacion.id);
    if (!sumaBruta) throw ApiError.notFound('La evaluación no tiene suma bruta registrada');
    return sumaBruta;
  },

  async createSumaBruta(evaluacionUuid, payload, actorId, user) {
    const evaluacion = await findEvaluacionByUuidOrFail(evaluacionUuid, user);

    const existing = await sumaBrutaRepository.findByEvaluacionId(evaluacion.id);
    if (existing) throw ApiError.conflict('Esta evaluación ya tiene una suma bruta registrada');

    return sequelize.transaction(async (transaction) => {
      const sumaBruta = await sumaBrutaRepository.create(
        {
          evaluacionId: evaluacion.id,
          hojasFuncionales: payload.hojasFuncionales,
          candela: payload.candela,
          estado: true,
          createdBy: actorId,
        },
        { transaction },
      );

      if (payload.estadios?.length) {
        await sumaBrutaRepository.createEstadios(
          payload.estadios.map((estadio) => ({
            sumaBrutaId: sumaBruta.id,
            numeroHoja: estadio.numeroHoja,
            estadio: estadio.estadio,
            createdBy: actorId,
          })),
          { transaction },
        );
      }

      return sumaBrutaRepository.findByEvaluacionId(evaluacion.id, { transaction });
    });
  },

  async updateSumaBruta(evaluacionUuid, payload, actorId, user) {
    const evaluacion = await findEvaluacionByUuidOrFail(evaluacionUuid, user);
    const sumaBruta = await sumaBrutaRepository.findByEvaluacionId(evaluacion.id);
    if (!sumaBruta) throw ApiError.notFound('La evaluación no tiene suma bruta registrada');

    return sequelize.transaction(async (transaction) => {
      const data = { updatedBy: actorId };
      if (payload.hojasFuncionales !== undefined) data.hojasFuncionales = payload.hojasFuncionales;
      if (payload.candela !== undefined) data.candela = payload.candela;
      if (payload.estado !== undefined) data.estado = payload.estado;

      await sumaBrutaRepository.update(sumaBruta, data, { transaction });

      if (payload.estadios) {
        await sumaBrutaRepository.replaceEstadios(
          sumaBruta.id,
          payload.estadios.map((estadio) => ({
            sumaBrutaId: sumaBruta.id,
            numeroHoja: estadio.numeroHoja,
            estadio: estadio.estadio,
            createdBy: actorId,
          })),
          { transaction },
        );
      }

      return sumaBrutaRepository.findByEvaluacionId(evaluacion.id, { transaction });
    });
  },
};

export default sumaBrutaService;
