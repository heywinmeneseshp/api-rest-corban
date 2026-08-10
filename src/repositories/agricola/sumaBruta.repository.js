import { Op } from 'sequelize';
import { SumaBruta, EstadioHoja, EstadioSigatoka } from '../../database/associations.js';

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

  // Valores activos de la tabla `estadios_sigatoka` para las denominaciones dadas.
  findEstadiosValuesByNames(estadios, { transaction } = {}) {
    if (!estadios?.length) return Promise.resolve([]);
    return EstadioSigatoka.findAll({
      where: { estadio: { [Op.in]: estadios }, estado: true },
      attributes: ['estadio', 'valorL3', 'valorL4', 'valorL5'],
      transaction,
    });
  },
};

export default sumaBrutaRepository;
