import { Op } from 'sequelize';
import { ProductoCategoria } from '../../database/associations.js';

export const productoCategoriaRepository = {
  async findAndCountAll({ limit, offset, search, tipo, estado }) {
    const where = {
      ...(search ? { nombre: { [Op.like]: `%${search}%` } } : {}),
      ...(tipo ? { tipo } : {}),
      ...(estado !== undefined ? { estado } : {}),
    };
    return ProductoCategoria.findAndCountAll({ where, limit, offset, order: [['nombre', 'ASC']] });
  },

  findByUuid(uuid) {
    return ProductoCategoria.findOne({ where: { uuid } });
  },

  findByNombre(nombre) {
    return ProductoCategoria.findOne({ where: { nombre } });
  },

  findByNombreIncludingDeleted(nombre) {
    return ProductoCategoria.findOne({ where: { nombre }, paranoid: false });
  },

  create(data, { transaction } = {}) {
    return ProductoCategoria.create(data, { transaction });
  },

  async update(categoria, data, { transaction } = {}) {
    await categoria.update(data, { transaction });
    return categoria;
  },

  async restore(categoria, { transaction } = {}) {
    await categoria.restore({ transaction });
    return categoria;
  },

  async softDelete(categoria, deletedBy, { transaction } = {}) {
    await categoria.update({ deletedBy }, { transaction });
    await categoria.destroy({ transaction });
    return categoria;
  },
};

export default productoCategoriaRepository;
