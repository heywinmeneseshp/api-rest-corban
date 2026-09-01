import { Op } from 'sequelize';
import { Articulo, ArticuloCategoria, UnidadMedida } from '../../database/associations.js';

const INCLUDE = [
  { model: ArticuloCategoria, as: 'categoria', attributes: ['uuid', 'nombre', 'tipo'] },
  { model: UnidadMedida, as: 'unidadMedida', attributes: ['uuid', 'nombre', 'simbolo'] },
];

export const articuloRepository = {
  async findAndCountAll({ limit, offset, search, tipo, categoriaUuid, unidadMedidaUuid, estado, manejaInventario }) {
    const where = {
      ...(search ? { [Op.or]: [{ codigo: { [Op.like]: `%${search}%` } }, { nombre: { [Op.like]: `%${search}%` } }] } : {}),
      ...(estado !== undefined ? { estado } : {}),
      ...(manejaInventario !== undefined ? { manejaInventario } : {}),
    };
    // El artículo ya no tiene su propio `tipo` — filtra por el de su
    // categoría (join). `subQuery: false` para que el filtro sobre la
    // tabla incluida se aplique antes del LIMIT (si no, Sequelize pagina
    // primero y el filtro no encuentra nada).
    if (tipo) where['$categoria.tipo$'] = tipo;

    if (categoriaUuid) {
      const cat = await ArticuloCategoria.findOne({ where: { uuid: categoriaUuid } });
      where.categoriaId = cat ? cat.id : -1;
    }
    if (unidadMedidaUuid) {
      const uni = await UnidadMedida.findOne({ where: { uuid: unidadMedidaUuid } });
      where.unidadMedidaId = uni ? uni.id : -1;
    }

    return Articulo.findAndCountAll({ where, limit, offset, order: [['nombre', 'ASC']], include: INCLUDE, subQuery: false });
  },

  findByUuid(uuid) {
    return Articulo.findOne({ where: { uuid }, include: INCLUDE });
  },

  findByNombre(nombre) {
    return Articulo.findOne({ where: { nombre } });
  },

  findByNombreIncludingDeleted(nombre) {
    return Articulo.findOne({ where: { nombre }, paranoid: false });
  },

  create(data, { transaction } = {}) {
    return Articulo.create(data, { transaction });
  },

  async update(articulo, data, { transaction } = {}) {
    await articulo.update(data, { transaction });
    return articulo;
  },

  async softDelete(articulo, deletedBy, { transaction } = {}) {
    await articulo.update({ deletedBy }, { transaction });
    await articulo.destroy({ transaction });
    return articulo;
  },
};

export default articuloRepository;
