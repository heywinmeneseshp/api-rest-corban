import { almacenRepository } from '../../repositories/inventario/almacen.repository.js';
import { Almacen, Finca, User } from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { assertSinDuplicado } from '../../utils/duplicadoGuard.js';
import { sequelize } from '../../database/connection.js';

export const almacenService = {
  async list(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await almacenRepository.findAndCountAll({
      limit,
      offset,
      search: query.search,
      tipo: query.tipo,
      parentUuid: query.parentUuid,
      estado: query.estado,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async listTree() {
    const all = await almacenRepository.findAllTree();
    // Construye árbol jerárquico
    const map = new Map(all.map((a) => [a.id, { ...a.toJSON(), hijos: [] }]));
    const roots = [];
    for (const node of map.values()) {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId).hijos.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  },

  async getByUuid(uuid) {
    const alm = await almacenRepository.findByUuid(uuid);
    if (!alm) throw ApiError.notFound('Almacén no encontrado');
    return alm;
  },

  async create(payload, actorId) {
    let parentId = null;
    if (payload.parentUuid) {
      const padre = await Almacen.findOne({ where: { uuid: payload.parentUuid } });
      if (!padre) throw ApiError.notFound('Almacén padre no encontrado');
      parentId = padre.id;
    }
    let ubicacionFincaId = null;
    if (payload.ubicacionFincaUuid) {
      const finca = await Finca.findOne({ where: { uuid: payload.ubicacionFincaUuid } });
      if (!finca) throw ApiError.notFound('Finca no encontrada');
      ubicacionFincaId = finca.id;
    }
    let responsableId = null;
    if (payload.responsableUuid) {
      const user = await User.findOne({ where: { uuid: payload.responsableUuid } });
      if (!user) throw ApiError.notFound('Responsable no encontrado');
      responsableId = user.id;
    }

    return sequelize.transaction(async (t) => {
      // No había ningún chequeo de nombre duplicado acá antes.
      await assertSinDuplicado(Almacen, { nombre: payload.nombre }, t, 'Ya existe un almacén con ese nombre');
      return almacenRepository.create(
        {
          codigo: payload.codigo || null,
          nombre: payload.nombre,
          descripcion: payload.descripcion,
          tipo: payload.tipo || 'ALMACEN',
          parentId,
          ubicacionFincaId,
          responsableId,
          estado: payload.estado ?? true,
          createdBy: actorId,
        },
        { transaction: t },
      );
    });
  },

  async update(uuid, payload, actorId) {
    const alm = await this.getByUuid(uuid);
    const data = { ...payload, updatedBy: actorId };

    if (payload.parentUuid !== undefined) {
      if (payload.parentUuid === null) data.parentId = null;
      else {
        const padre = await Almacen.findOne({ where: { uuid: payload.parentUuid } });
        if (!padre) throw ApiError.notFound('Almacén padre no encontrado');
        if (padre.id === alm.id) throw ApiError.badRequest('Un almacén no puede ser padre de sí mismo');
        data.parentId = padre.id;
      }
      delete data.parentUuid;
    }
    if (payload.ubicacionFincaUuid !== undefined) {
      if (payload.ubicacionFincaUuid === null) data.ubicacionFincaId = null;
      else {
        const finca = await Finca.findOne({ where: { uuid: payload.ubicacionFincaUuid } });
        if (!finca) throw ApiError.notFound('Finca no encontrada');
        data.ubicacionFincaId = finca.id;
      }
      delete data.ubicacionFincaUuid;
    }
    if (payload.responsableUuid !== undefined) {
      if (payload.responsableUuid === null) data.responsableId = null;
      else {
        const user = await User.findOne({ where: { uuid: payload.responsableUuid } });
        if (!user) throw ApiError.notFound('Responsable no encontrado');
        data.responsableId = user.id;
      }
      delete data.responsableUuid;
    }

    return sequelize.transaction(async (t) => {
      if (payload.nombre) {
        await assertSinDuplicado(Almacen, { nombre: payload.nombre }, t, 'Ya existe un almacén con ese nombre', alm.id);
      }
      return almacenRepository.update(alm, data, { transaction: t });
    });
  },

  async delete(uuid, actorId) {
    const alm = await this.getByUuid(uuid);
    // No permitir borrar si tiene hijos
    const hijos = await Almacen.count({ where: { parentId: alm.id } });
    if (hijos > 0) throw ApiError.badRequest('No se puede eliminar un almacén con subalmacenes');
    await almacenRepository.softDelete(alm, actorId);
  },
};

export default almacenService;
