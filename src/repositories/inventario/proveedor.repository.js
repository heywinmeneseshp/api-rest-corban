import { Op } from 'sequelize';
import { Proveedor } from '../../database/associations.js';

export const proveedorRepository = {
  async findAndCountAll({ limit, offset, search, estado }) {
    const where = {
      ...(search ? { nombre: { [Op.like]: `%${search}%` } } : {}),
      ...(estado !== undefined ? { estado } : {}),
    };
    return Proveedor.findAndCountAll({ where, limit, offset, order: [['nombre', 'ASC']] });
  },

  findByUuid(uuid) {
    return Proveedor.findOne({ where: { uuid } });
  },

  findByNombre(nombre) {
    return Proveedor.findOne({ where: { nombre } });
  },

  create(data, { transaction } = {}) {
    return Proveedor.create(data, { transaction });
  },

  async update(proveedor, data, { transaction } = {}) {
    await proveedor.update(data, { transaction });
    return proveedor;
  },

  async softDelete(proveedor, deletedBy, { transaction } = {}) {
    await proveedor.update({ deletedBy }, { transaction });
    await proveedor.destroy({ transaction });
    return proveedor;
  },
};

export default proveedorRepository;
