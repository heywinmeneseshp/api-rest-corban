import { facturaRepository } from '../../repositories/inventario/factura.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';

// Solo lectura — una factura se crea ÚNICAMENTE al convertir una proforma
// (ver proforma.service.js#convertir), no tiene create/update/delete propios.
export const facturaService = {
  async list(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await facturaRepository.findAndCountAll({
      limit,
      offset,
      search: query.search,
      estado: query.estado,
      fechaDesde: query.fechaDesde,
      fechaHasta: query.fechaHasta,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getByUuid(uuid) {
    const factura = await facturaRepository.findByUuid(uuid);
    if (!factura) throw ApiError.notFound('Factura no encontrada');
    return factura;
  },
};

export default facturaService;
