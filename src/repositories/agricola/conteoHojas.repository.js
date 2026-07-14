import { ConteoHojas, Semana } from '../../database/associations.js';

export const conteoHojasRepository = {
  findByEvaluacionId(evaluacionId) {
    return ConteoHojas.findOne({
      where: { evaluacionId },
      include: [{ model: Semana, as: 'semanaEmbolse', attributes: ['id', 'uuid', 'codigo'] }],
    });
  },

  create(data, { transaction } = {}) {
    return ConteoHojas.create(data, { transaction });
  },

  async update(conteo, data, { transaction } = {}) {
    await conteo.update(data, { transaction });
    return conteo;
  },
};

export default conteoHojasRepository;
