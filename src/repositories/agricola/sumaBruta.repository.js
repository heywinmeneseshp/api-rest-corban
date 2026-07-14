import { SumaBruta, EstadioHoja } from '../../database/associations.js';

export const sumaBrutaRepository = {
  findByEvaluacionId(evaluacionId, { transaction } = {}) {
    return SumaBruta.findOne({
      where: { evaluacionId },
      include: [{ model: EstadioHoja, as: 'estadios', order: [['numeroHoja', 'ASC']] }],
      transaction,
    });
  },

  create(data, { transaction } = {}) {
    return SumaBruta.create(data, { transaction });
  },

  createEstadios(estadios, { transaction } = {}) {
    return EstadioHoja.bulkCreate(estadios, { transaction });
  },

  async update(sumaBruta, data, { transaction } = {}) {
    await sumaBruta.update(data, { transaction });
    return sumaBruta;
  },

  async replaceEstadios(sumaBrutaId, estadios, { transaction } = {}) {
    await EstadioHoja.destroy({ where: { sumaBrutaId }, transaction });
    return EstadioHoja.bulkCreate(estadios, { transaction });
  },
};

export default sumaBrutaRepository;
