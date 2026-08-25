import { productoInventarioRepository } from '../../repositories/inventario/productoInventario.repository.js';
import { ProductoCategoria, UnidadMedida } from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';

export const productoInventarioService = {
  async list(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await productoInventarioRepository.findAndCountAll({
      limit,
      offset,
      search: query.search,
      tipo: query.tipo,
      categoriaUuid: query.categoriaUuid,
      unidadMedidaUuid: query.unidadMedidaUuid,
      estado: query.estado,
      manejaInventario: query.manejaInventario,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getByUuid(uuid) {
    const prod = await productoInventarioRepository.findByUuid(uuid);
    if (!prod) throw ApiError.notFound('Producto no encontrado');
    return prod;
  },

  async create(payload, actorId) {
    const existing = await productoInventarioRepository.findByNombre(payload.nombre);
    if (existing) throw ApiError.conflict('Ya existe un producto con ese nombre');

    let categoriaId = null;
    if (payload.categoriaUuid) {
      const cat = await ProductoCategoria.findOne({ where: { uuid: payload.categoriaUuid } });
      if (!cat) throw ApiError.notFound('Categoría no encontrada');
      categoriaId = cat.id;
    }
    let unidadMedidaId = null;
    if (payload.unidadMedidaUuid) {
      const uni = await UnidadMedida.findOne({ where: { uuid: payload.unidadMedidaUuid } });
      if (!uni) throw ApiError.notFound('Unidad de medida no encontrada');
      unidadMedidaId = uni.id;
    }

    return productoInventarioRepository.create({
      codigo: payload.codigo || null,
      nombre: payload.nombre,
      descripcion: payload.descripcion,
      tipo: payload.tipo || 'GENERAL',
      categoriaId,
      unidadMedidaId,
      costoCompra: payload.costoCompra ?? 0,
      precioVenta: payload.precioVenta ?? 0,
      manejaInventario: payload.manejaInventario ?? true,
      stockMinimo: payload.stockMinimo ?? 0,
      stockMaximo: payload.stockMaximo ?? null,
      estado: payload.estado ?? true,
      createdBy: actorId,
    });
  },

  async update(uuid, payload, actorId) {
    const prod = await this.getByUuid(uuid);
    if (payload.nombre) {
      const existing = await productoInventarioRepository.findByNombre(payload.nombre);
      if (existing && existing.id !== prod.id) throw ApiError.conflict('Ya existe un producto con ese nombre');
    }

    const data = { ...payload, updatedBy: actorId };
    if (payload.categoriaUuid !== undefined) {
      if (payload.categoriaUuid === null) data.categoriaId = null;
      else {
        const cat = await ProductoCategoria.findOne({ where: { uuid: payload.categoriaUuid } });
        if (!cat) throw ApiError.notFound('Categoría no encontrada');
        data.categoriaId = cat.id;
      }
      delete data.categoriaUuid;
    }
    if (payload.unidadMedidaUuid !== undefined) {
      if (payload.unidadMedidaUuid === null) data.unidadMedidaId = null;
      else {
        const uni = await UnidadMedida.findOne({ where: { uuid: payload.unidadMedidaUuid } });
        if (!uni) throw ApiError.notFound('Unidad de medida no encontrada');
        data.unidadMedidaId = uni.id;
      }
      delete data.unidadMedidaUuid;
    }

    return productoInventarioRepository.update(prod, data);
  },

  async delete(uuid, actorId) {
    const prod = await this.getByUuid(uuid);
    await productoInventarioRepository.softDelete(prod, actorId);
  },
};

export default productoInventarioService;
