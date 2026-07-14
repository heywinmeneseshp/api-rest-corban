import { Permiso } from '../../database/associations.js';
import { menuItemRepository } from '../../repositories/seguridad/menuItem.repository.js';
import { ApiError } from '../../utils/ApiError.js';

const buildTree = (items, parentId = null) =>
  items
    .filter((item) => item.parentId === parentId)
    .map((item) => ({
      ...item.toJSON(),
      children: buildTree(items, item.id),
    }));

const filterVisible = (nodes, userPermissions) =>
  nodes
    .map((node) => ({ ...node, children: filterVisible(node.children, userPermissions) }))
    .filter((node) => !node.permiso || userPermissions.includes(node.permiso.codigo) || node.children.length > 0);

const findPermisoByUuidOrFail = async (permisoUuid) => {
  const permiso = await Permiso.findOne({ where: { uuid: permisoUuid } });
  if (!permiso) throw ApiError.notFound('Permiso no encontrado');
  return permiso;
};

const findParentByUuidOrFail = async (parentUuid) => {
  const parent = await menuItemRepository.findByUuid(parentUuid);
  if (!parent) throw ApiError.notFound('Ítem de menú padre no encontrado');
  return parent;
};

export const menuItemService = {
  async getMenuTree(userPermissions = []) {
    const items = await menuItemRepository.findAll();
    const tree = buildTree(items);
    return filterVisible(tree, userPermissions);
  },

  async getMenuItemByUuid(uuid) {
    const menuItem = await menuItemRepository.findByUuid(uuid);
    if (!menuItem) throw ApiError.notFound('Ítem de menú no encontrado');
    return menuItem;
  },

  async createMenuItem(payload, actorId) {
    const data = {
      nombre: payload.nombre,
      tipo: payload.tipo,
      ruta: payload.ruta,
      icono: payload.icono,
      orden: payload.orden ?? 0,
      createdBy: actorId,
    };

    if (payload.parentUuid) {
      const parent = await findParentByUuidOrFail(payload.parentUuid);
      data.parentId = parent.id;
    }

    if (payload.permisoUuid) {
      const permiso = await findPermisoByUuidOrFail(payload.permisoUuid);
      data.permisoId = permiso.id;
    }

    return menuItemRepository.create(data);
  },

  async updateMenuItem(uuid, payload, actorId) {
    const menuItem = await this.getMenuItemByUuid(uuid);
    const data = { updatedBy: actorId };

    if (payload.nombre !== undefined) data.nombre = payload.nombre;
    if (payload.tipo !== undefined) data.tipo = payload.tipo;
    if (payload.ruta !== undefined) data.ruta = payload.ruta;
    if (payload.icono !== undefined) data.icono = payload.icono;
    if (payload.orden !== undefined) data.orden = payload.orden;

    if (payload.parentUuid !== undefined) {
      if (payload.parentUuid === null) {
        data.parentId = null;
      } else {
        if (payload.parentUuid === uuid) {
          throw ApiError.badRequest('Un ítem de menú no puede ser padre de sí mismo');
        }
        const parent = await findParentByUuidOrFail(payload.parentUuid);
        data.parentId = parent.id;
      }
    }

    if (payload.permisoUuid !== undefined) {
      if (payload.permisoUuid === null) {
        data.permisoId = null;
      } else {
        const permiso = await findPermisoByUuidOrFail(payload.permisoUuid);
        data.permisoId = permiso.id;
      }
    }

    return menuItemRepository.update(menuItem, data);
  },

  async deleteMenuItem(uuid, actorId) {
    const menuItem = await this.getMenuItemByUuid(uuid);
    await menuItemRepository.softDelete(menuItem, actorId);
  },
};

export default menuItemService;
