import { Semana } from '../../database/associations.js';
import { conteoHojasRepository } from '../../repositories/agricola/conteoHojas.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { findEvaluacionByUuidOrFail } from './evaluacionLookup.js';

const findSemanaByUuidOrFail = async (uuid) => {
  const semana = await Semana.findOne({ where: { uuid } });
  if (!semana) throw ApiError.notFound('Semana de embolse no encontrada');
  return semana;
};

export const conteoHojasService = {
  async getConteoByEvaluacionUuid(evaluacionUuid) {
    const evaluacion = await findEvaluacionByUuidOrFail(evaluacionUuid);
    const conteo = await conteoHojasRepository.findByEvaluacionId(evaluacion.id);
    if (!conteo) throw ApiError.notFound('La evaluación no tiene conteo de hojas registrado');
    return conteo;
  },

  async createConteo(evaluacionUuid, payload, actorId) {
    const evaluacion = await findEvaluacionByUuidOrFail(evaluacionUuid);

    const existing = await conteoHojasRepository.findByEvaluacionId(evaluacion.id);
    if (existing) throw ApiError.conflict('Esta evaluación ya tiene un conteo de hojas registrado');

    const semanaEmbolse = await findSemanaByUuidOrFail(payload.semanaEmbolseUuid);

    return conteoHojasRepository.create({
      evaluacionId: evaluacion.id,
      semanaEmbolseId: semanaEmbolse.id,
      hojasFuncionales: payload.hojasFuncionales,
      estado: true,
      createdBy: actorId,
    });
  },

  async updateConteo(evaluacionUuid, payload, actorId) {
    const evaluacion = await findEvaluacionByUuidOrFail(evaluacionUuid);
    const conteo = await conteoHojasRepository.findByEvaluacionId(evaluacion.id);
    if (!conteo) throw ApiError.notFound('La evaluación no tiene conteo de hojas registrado');

    const data = { updatedBy: actorId };
    if (payload.semanaEmbolseUuid) {
      data.semanaEmbolseId = (await findSemanaByUuidOrFail(payload.semanaEmbolseUuid)).id;
    }
    if (payload.hojasFuncionales !== undefined) data.hojasFuncionales = payload.hojasFuncionales;
    if (payload.estado !== undefined) data.estado = payload.estado;

    return conteoHojasRepository.update(conteo, data);
  },
};

export default conteoHojasService;
