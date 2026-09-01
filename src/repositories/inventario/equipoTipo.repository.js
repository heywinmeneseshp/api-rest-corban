import { Op } from 'sequelize';
import { EquipoTipo } from '../../database/associations.js';

export const equipoTipoRepository = {
  async findAndCountAll({ limit, offset, search, estado }) {
    const where = {
      ...(search ? { nombre: { [Op.like]: `%${search}%` } } : {}),
      ...(estado !== undefined ? { estado } : {}),
    };
    return EquipoTipo.findAndCountAll({ where, limit, offset, order: [['nombre', 'ASC']] });
  },

  findByUuid(uuid) {
    return EquipoTipo.findOne({ where: { uuid } });
  },

  findByNombre(nombre) {
    return EquipoTipo.findOne({ where: { nombre } });
  },

  create(data, { transaction } = {}) {
    return EquipoTipo.create(data, { transaction });
  },

  async update(tipo, data, { transaction } = {}) {
    await tipo.update(data, { transaction });
    return tipo;
  },

  async softDelete(tipo, deletedBy, { transaction } = {}) {
    await tipo.update({ deletedBy }, { transaction });
    await tipo.destroy({ transaction });
    return tipo;
  },
};

export default equipoTipoRepository;
