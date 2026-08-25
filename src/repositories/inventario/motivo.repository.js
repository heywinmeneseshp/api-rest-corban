import { Op } from 'sequelize';
import { Motivo } from '../../database/associations.js';

export const motivoRepository = {
  async findAndCountAll({ limit, offset, search, tipo, estado }) {
    const where = {
      ...(search ? { nombre: { [Op.like]: `%${search}%` } } : {}),
      ...(tipo ? { tipo } : {}),
      ...(estado !== undefined ? { estado } : {}),
    };
    return Motivo.findAndCountAll({ where, limit, offset, order: [['nombre', 'ASC']] });
  },

  findByUuid(uuid) {
    return Motivo.findOne({ where: { uuid } });
  },

  create(data, { transaction } = {}) {
    return Motivo.create(data, { transaction });
  },

  async update(motivo, data, { transaction } = {}) {
    await motivo.update(data, { transaction });
    return motivo;
  },

  async softDelete(motivo, deletedBy, { transaction } = {}) {
    await motivo.update({ deletedBy }, { transaction });
    await motivo.destroy({ transaction });
    return motivo;
  },
};

export default motivoRepository;
