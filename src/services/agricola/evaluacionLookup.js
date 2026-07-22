import { Evaluacion, Planta, Lote, Finca } from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';
import { getFincaIdsPermitidas } from '../../utils/fincaScope.js';

// `user` opcional: si se da y tiene restricción de fincas, una evaluación
// cuya planta está en una finca fuera de su alcance se trata como si no
// existiera (404). ConteoHojas, Infeccion y SumaBruta dependen de esta
// misma función para heredar el scoping sin duplicar lógica.
export const findEvaluacionByUuidOrFail = async (uuid, user) => {
  const evaluacion = await Evaluacion.findOne({
    where: { uuid },
    include: [
      {
        model: Planta,
        as: 'planta',
        attributes: ['id', 'uuid', 'loteId'],
        include: [{ model: Lote, as: 'lote', attributes: ['id', 'uuid', 'fincaId'] }],
      },
    ],
  });
  if (!evaluacion) throw ApiError.notFound('Evaluación no encontrada');

  const permitidas = getFincaIdsPermitidas(user);
  if (permitidas !== null && !permitidas.includes(evaluacion.planta?.lote?.fincaId)) {
    throw ApiError.notFound('Evaluación no encontrada');
  }

  return evaluacion;
};

export default findEvaluacionByUuidOrFail;
