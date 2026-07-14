import { Evaluacion } from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';

export const findEvaluacionByUuidOrFail = async (uuid) => {
  const evaluacion = await Evaluacion.findOne({ where: { uuid } });
  if (!evaluacion) throw ApiError.notFound('Evaluación no encontrada');
  return evaluacion;
};

export default findEvaluacionByUuidOrFail;
