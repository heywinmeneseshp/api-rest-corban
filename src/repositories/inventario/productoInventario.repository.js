import { Op } from 'sequelize';
import { Producto, ProductoCategoria, UnidadMedida } from '../../database/associations.js';

const INCLUDE = [
  { model: ProductoCategoria, as: 'categoria', attributes: ['uuid', 'nombre'] },
  { model: UnidadMedida, as: 'unidadMedida', attributes: ['uuid', 'nombre', 'simbolo'] },
];

export const productoInventarioRepository = {
  async findAndCountAll({ limit, offset, search, tipo, categoriaUuid, unidadMedidaUuid, estado, manejaInventario }) {
    const where = {
      ...(search ? { [Op.or]: [{ codigo: { [Op.like]: `%${search}%` } }, { nombre: { [Op.like]: `%${search}%` } }] } : {}),
      ...(tipo ? { tipo } : {}),
      ...(estado !== undefined ? { estado } : {}),
      ...(manejaInventario !== undefined ? { manejaInventario } : {}),
    };

    if (categoriaUuid) {
      const cat = await ProductoCategoria.findOne({ where: { uuid: categoriaUuid } });
      where.categoriaId = cat ? cat.id : -1;
    }
    if (unidadMedidaUuid) {
      const uni = await UnidadMedida.findOne({ where: { uuid: unidadMedidaUuid } });
      where.unidadMedidaId = uni ? uni.id : -1;
    }

    return Producto.findAndCountAll({ where, limit, offset, order: [['nombre', 'ASC']], include: INCLUDE });
  },

  findByUuid(uuid) {
    return Producto.findOne({ where: { uuid }, include: INCLUDE });
  },

  findByNombre(nombre) {
    return Producto.findOne({ where: { nombre } });
  },

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

  async softDelete(producto, deletedBy, { transaction } = {}) {
    await producto.update({ deletedBy }, { transaction });
    await producto.destroy({ transaction });
    return producto;
  },
};

export default productoInventarioRepository;
