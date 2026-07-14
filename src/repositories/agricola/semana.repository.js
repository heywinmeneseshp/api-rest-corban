import { Semana } from '../../database/associations.js';

export const semanaRepository = {
  async findAndCountAll({ limit, offset, anio }) {
    const where = anio ? { anio } : undefined;
    return Semana.findAndCountAll({
      where,
      limit,
      offset,
      order: [
        ['anio', 'DESC'],
        ['numeroSemana', 'DESC'],
      ],
    });
  },

  findByUuid(uuid) {
    return Semana.findOne({ where: { uuid } });
  },

  findById(id) {
    return Semana.findByPk(id);
  },

  findByCodigo(codigo) {
    return Semana.findOne({ where: { codigo } });
  },

  findByAnioAndNumero(anio, numeroSemana) {
    return Semana.findOne({ where: { anio, numeroSemana } });
  },

  create(data, { transaction } = {}) {
    return Semana.create(data, { transaction });
  },

  async update(semana, data, { transaction } = {}) {
    await semana.update(data, { transaction });
    return semana;
  },

  async softDelete(semana, deletedBy, { transaction } = {}) {
    await semana.update({ deletedBy }, { transaction });
    await semana.destroy({ transaction });
    return semana;
  },
};

export default semanaRepository;
