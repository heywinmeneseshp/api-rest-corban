import { Op } from 'sequelize';
import { ArticuloCategoria } from '../../database/associations.js';

export const articuloCategoriaRepository = {
  async findAndCountAll({ limit, offset, search, tipo, estado }) {
    const where = {
      ...(search ? { nombre: { [Op.like]: `%${search}%` } } : {}),
      ...(tipo ? { tipo } : {}),
      ...(estado !== undefined ? { estado } : {}),
    };
    return ArticuloCategoria.findAndCountAll({ where, limit, offset, order: [['nombre', 'ASC']] });
  },

  findByUuid(uuid) {
    return ArticuloCategoria.findOne({ where: { uuid } });
  },

  findByNombre(nombre) {
    return ArticuloCategoria.findOne({ where: { nombre } });
  },

  findByNombreIncludingDeleted(nombre) {
    return ArticuloCategoria.findOne({ where: { nombre }, paranoid: false });
  },

  create(data, { transaction } = {}) {
    return ArticuloCategoria.create(data, { transaction });
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

export default articuloCategoriaRepository;
