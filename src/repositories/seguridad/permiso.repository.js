import { Op } from 'sequelize';
import { Permiso } from '../../database/associations.js';

export const permisoRepository = {
  async findAndCountAll({ limit, offset, search }) {
    const where = search
      ? {
          [Op.or]: [
            { codigo: { [Op.like]: `%${search}%` } },
            { nombre: { [Op.like]: `%${search}%` } },
          ],
        }
      : undefined;

    return Permiso.findAndCountAll({ where, limit, offset, order: [['id', 'ASC']] });
  },

  findByUuid(uuid) {
    return Permiso.findOne({ where: { uuid } });
  },

  findById(id) {
    return Permiso.findByPk(id);
  },

  findByCodigo(codigo) {
    return Permiso.findOne({ where: { codigo } });
  },

  create(data, { transaction } = {}) {
    return Permiso.create(data, { transaction });
  },

  async update(permiso, data, { transaction } = {}) {
    await permiso.update(data, { transaction });
    return permiso;
  },

  async softDelete(permiso, deletedBy, { transaction } = {}) {
    await permiso.update({ deletedBy }, { transaction });
    await permiso.destroy({ transaction });
    return permiso;
  },
};

export default permisoRepository;
