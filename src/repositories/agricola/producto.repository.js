import { Op } from 'sequelize';
import { Producto } from '../../database/associations.js';

export const productoRepository = {
  async findAndCountAll({ limit, offset, search }) {
    const where = search
      ? {
          [Op.or]: [
            { codigo: { [Op.like]: `%${search}%` } },
            { nombre: { [Op.like]: `%${search}%` } },
          ],
        }
      : {};
    return Producto.findAndCountAll({ where, limit, offset, order: [['nombre', 'ASC']] });
  },

  findAll() {
    return Producto.findAll({ order: [['nombre', 'ASC']] });
  },

  findByUuid(uuid) {
    return Producto.findOne({ where: { uuid } });
  },

  findById(id) {
    return Producto.findByPk(id);
  },

  findByNombre(nombre) {
    return Producto.findOne({ where: { nombre } });
  },

  // Incluye productos eliminados lógicamente (paranoid: false) — el UNIQUE
  // de `nombre` no distingue soft-deletes, hay que revisar esto antes de
  // crear para no chocar con la restricción (mismo criterio que fincas).
  findByNombreIncludingDeleted(nombre) {
    return Producto.findOne({ where: { nombre }, paranoid: false });
  },

  create(data, { transaction } = {}) {
    return Producto.create(data, { transaction });
  },

  async update(producto, data, { transaction } = {}) {
    await producto.update(data, { transaction });
    return producto;
  },

  async restore(producto, { transaction } = {}) {
    await producto.restore({ transaction });
    return producto;
  },

  async softDelete(producto, deletedBy, { transaction } = {}) {
    await producto.update({ deletedBy }, { transaction });
    await producto.destroy({ transaction });
    return producto;
  },
};

export default productoRepository;
