import { Op } from 'sequelize';
import { Producto, ProductoCategoria, UnidadMedida } from '../../database/associations.js';

const INCLUDE = [
  { model: ProductoCategoria, as: 'categoria', attributes: ['uuid', 'nombre', 'tipo'] },
  { model: UnidadMedida, as: 'unidadMedida', attributes: ['uuid', 'nombre', 'simbolo'] },
];

export const productoInventarioRepository = {
  async findAndCountAll({ limit, offset, search, tipo, categoriaUuid, unidadMedidaUuid, estado, manejaInventario }) {
    const where = {
      ...(search ? { [Op.or]: [{ codigo: { [Op.like]: `%${search}%` } }, { nombre: { [Op.like]: `%${search}%` } }] } : {}),
      ...(estado !== undefined ? { estado } : {}),
      ...(manejaInventario !== undefined ? { manejaInventario } : {}),
    };
    // El producto ya no tiene su propio `tipo` — filtra por el de su
    // categoría (join). `subQuery: false` para que el filtro sobre la
    // tabla incluida se aplique antes del LIMIT (si no, Sequelize pagina
    // primero y el filtro no encuentra nada).
    if (tipo) where['$categoria.tipo$'] = tipo;

    if (categoriaUuid) {
      const cat = await ProductoCategoria.findOne({ where: { uuid: categoriaUuid } });
      where.categoriaId = cat ? cat.id : -1;
    }
    if (unidadMedidaUuid) {
      const uni = await UnidadMedida.findOne({ where: { uuid: unidadMedidaUuid } });
      where.unidadMedidaId = uni ? uni.id : -1;
    }

    return Producto.findAndCountAll({ where, limit, offset, order: [['nombre', 'ASC']], include: INCLUDE, subQuery: false });
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
