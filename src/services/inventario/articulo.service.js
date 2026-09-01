import { articuloRepository } from '../../repositories/inventario/articulo.repository.js';
import { ArticuloCategoria, UnidadMedida, Articulo } from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { assertSinDuplicado } from '../../utils/duplicadoGuard.js';
import { evaluarMargen } from '../../utils/margenComercial.js';
import { sequelize } from '../../database/connection.js';

export const articuloService = {
  async list(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await articuloRepository.findAndCountAll({
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
    const art = await articuloRepository.findByUuid(uuid);
    if (!art) throw ApiError.notFound('Artículo no encontrado');
    return art;
  },

  async create(payload, actorId) {
    let categoriaId = null;
    if (payload.categoriaUuid) {
      const cat = await ArticuloCategoria.findOne({ where: { uuid: payload.categoriaUuid } });
      if (!cat) throw ApiError.notFound('Categoría no encontrada');
      categoriaId = cat.id;
    }
    let unidadMedidaId = null;
    if (payload.unidadMedidaUuid) {
      const uni = await UnidadMedida.findOne({ where: { uuid: payload.unidadMedidaUuid } });
      if (!uni) throw ApiError.notFound('Unidad de medida no encontrada');
      unidadMedidaId = uni.id;
    }

    const articulo = await sequelize.transaction(async (t) => {
      await assertSinDuplicado(Articulo, { nombre: payload.nombre }, t, 'Ya existe un artículo con ese nombre');
      return articuloRepository.create(
        {
          codigo: payload.codigo || null,
          nombre: payload.nombre,
          descripcion: payload.descripcion,
          categoriaId,
          unidadMedidaId,
          costoCompra: payload.costoCompra ?? 0,
          precioVenta: payload.precioVenta ?? 0,
          manejaInventario: payload.manejaInventario ?? true,
          stockMinimo: payload.stockMinimo ?? 0,
          stockMaximo: payload.stockMaximo ?? null,
          estado: payload.estado ?? true,
          createdBy: actorId,
        },
        { transaction: t },
      );
    });
    return { ...articulo.toJSON(), advertencias: evaluarMargen(payload.precioVenta, payload.costoCompra) };
  },

  async update(uuid, payload, actorId) {
    const art = await this.getByUuid(uuid);

    const data = { ...payload, updatedBy: actorId };
    if (payload.categoriaUuid !== undefined) {
      if (payload.categoriaUuid === null) data.categoriaId = null;
      else {
        const cat = await ArticuloCategoria.findOne({ where: { uuid: payload.categoriaUuid } });
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

    const actualizado = await sequelize.transaction(async (t) => {
      if (payload.nombre) {
        await assertSinDuplicado(Articulo, { nombre: payload.nombre }, t, 'Ya existe un artículo con ese nombre', art.id);
      }
      return articuloRepository.update(art, data, { transaction: t });
    });
    const costoCompraFinal = payload.costoCompra !== undefined ? payload.costoCompra : art.costoCompra;
    const precioVentaFinal = payload.precioVenta !== undefined ? payload.precioVenta : art.precioVenta;
    return { ...actualizado.toJSON(), advertencias: evaluarMargen(precioVentaFinal, costoCompraFinal) };
  },

  async delete(uuid, actorId) {
    const art = await this.getByUuid(uuid);
    await articuloRepository.softDelete(art, actorId);
  },
};

export default articuloService;
