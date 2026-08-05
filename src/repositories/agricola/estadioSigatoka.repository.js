import { Op } from 'sequelize';
import { EstadioSigatoka } from '../../database/associations.js';

export const estadioSigatokaRepository = {
  async findAndCountAll({ limit, offset, search }) {
    const where = search ? { estadio: { [Op.like]: `%${search}%` } } : undefined;
    return EstadioSigatoka.findAndCountAll({
      where,
      limit,
      offset,
      order: [['orden', 'ASC'], ['estadio', 'ASC']],
    });
  },

  findByUuid(uuid) {
    return EstadioSigatoka.findOne({ where: { uuid } });
  },

  findById(id) {
    return EstadioSigatoka.findByPk(id);
  },

  findByEstadio(estadio) {
    return EstadioSigatoka.findOne({ where: { estadio } });
  },

  findAll() {
    return EstadioSigatoka.findAll({ order: [['orden', 'ASC'], ['estadio', 'ASC']] });
  },

  create(data, { transaction } = {}) {
    return EstadioSigatoka.create(data, { transaction });
  },

  async update(estadio, data, { transaction } = {}) {
    await estadio.update(data, { transaction });
    return estadio;
  },

  async softDelete(estadio, deletedBy, { transaction } = {}) {
    await estadio.update({ deletedBy }, { transaction });
    await estadio.destroy({ transaction });
    return estadio;
  },
};

export default estadioSigatokaRepository;
