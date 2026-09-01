import { proveedorRepository } from '../../repositories/inventario/proveedor.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';

export const proveedorService = {
  async list(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await proveedorRepository.findAndCountAll({
      limit,
      offset,
      search: query.search,
      estado: query.estado,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getByUuid(uuid) {
    const proveedor = await proveedorRepository.findByUuid(uuid);
    if (!proveedor) throw ApiError.notFound('Proveedor no encontrado');
    return proveedor;
  },

  async create(payload, actorId) {
    const existing = await proveedorRepository.findByNombre(payload.nombre);
    if (existing) throw ApiError.conflict('Ya existe un proveedor con ese nombre');
    return proveedorRepository.create({
      nombre: payload.nombre,
      identificacion: payload.identificacion || null,
      telefono: payload.telefono || null,
      email: payload.email || null,
      direccion: payload.direccion || null,
      observaciones: payload.observaciones || null,
      estado: payload.estado ?? true,
      createdBy: actorId,
    });
  },

  async update(uuid, payload, actorId) {
    const proveedor = await this.getByUuid(uuid);
    if (payload.nombre && payload.nombre !== proveedor.nombre) {
      const existing = await proveedorRepository.findByNombre(payload.nombre);
      if (existing && existing.id !== proveedor.id) throw ApiError.conflict('Ya existe un proveedor con ese nombre');
    }
    return proveedorRepository.update(proveedor, { ...payload, updatedBy: actorId });
  },

  async delete(uuid, actorId) {
    const proveedor = await this.getByUuid(uuid);
    await proveedorRepository.softDelete(proveedor, actorId);
  },
};

export default proveedorService;
