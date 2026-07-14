import { Infeccion, HojaInfectada } from '../../database/associations.js';

export const infeccionRepository = {
  findByEvaluacionId(evaluacionId, { transaction } = {}) {
    return Infeccion.findOne({
      where: { evaluacionId },
      include: [{ model: HojaInfectada, as: 'hojas', order: [['numeroHoja', 'ASC']] }],
      transaction,
    });
  },

  findById(id) {
    return Infeccion.findByPk(id);
  },

  create(data, { transaction } = {}) {
    return Infeccion.create(data, { transaction });
  },

  createHojas(hojas, { transaction } = {}) {
    return HojaInfectada.bulkCreate(hojas, { transaction });
  },

  async update(infeccion, data, { transaction } = {}) {
    await infeccion.update(data, { transaction });
    return infeccion;
  },

  async replaceHojas(infeccionId, hojas, { transaction } = {}) {
    await HojaInfectada.destroy({ where: { infeccionId }, transaction });
    return HojaInfectada.bulkCreate(hojas, { transaction });
  },
};

export default infeccionRepository;
