import { Op } from 'sequelize';
import { MotivoRecuse } from '../../database/associations.js';

export const motivoRecuseRepository = {
  async findAndCountAll({ limit, offset, search }) {
    const where = search
      ? {
          [Op.or]: [
            { nombre: { [Op.like]: `%${search}%` } },
            { descripcion: { [Op.like]: `%${search}%` } },
          ],
        }
      : undefined;

    return MotivoRecuse.findAndCountAll({ where, limit, offset, order: [['id', 'ASC']] });
  },

  findByUuid(uuid) {
    return MotivoRecuse.findOne({ where: { uuid } });
  },

  findById(id) {
    return MotivoRecuse.findByPk(id);
  },

  findByNombre(nombre) {
    return MotivoRecuse.findOne({ where: { nombre } });
  },

  create(data, { transaction } = {}) {
    return MotivoRecuse.create(data, { transaction });
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

export default motivoRecuseRepository;
