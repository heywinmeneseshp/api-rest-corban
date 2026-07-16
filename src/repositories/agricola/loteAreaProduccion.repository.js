import { LoteAreaProduccion } from '../../database/associations.js';

export const loteAreaProduccionRepository = {
  findAndCountByLoteId(loteId, { limit, offset }) {
    return LoteAreaProduccion.findAndCountAll({
      where: { loteId },
      limit,
      offset,
      order: [
        ['fechaRegistro', 'DESC'],
        ['id', 'DESC'],
      ],
    });
  },

  findLatestByLoteId(loteId) {
    return LoteAreaProduccion.findOne({
      where: { loteId },
      order: [
        ['fechaRegistro', 'DESC'],
        ['id', 'DESC'],
      ],
    });
  },

  create(data, { transaction } = {}) {
    return LoteAreaProduccion.create(data, { transaction });
  },
};

export default loteAreaProduccionRepository;
