import { roleService } from '../../services/seguridad/role.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const roleController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await roleService.listRoles(req.query);
    ApiResponse.send(res, { message: 'Roles obtenidos correctamente', data: { items, meta } });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const role = await roleService.getRoleByUuid(req.params.uuid);
    ApiResponse.send(res, { message: 'Rol obtenido correctamente', data: role });
  }),

  create: asyncHandler(async (req, res) => {
    const role = await roleService.createRole(req.body, req.user?.id);
    ApiResponse.send(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Rol creado correctamente',
      data: role,
    });
  }),

  update: asyncHandler(async (req, res) => {
    const role = await roleService.updateRole(req.params.uuid, req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Rol actualizado correctamente', data: role });
  }),

  remove: asyncHandler(async (req, res) => {
    await roleService.deleteRole(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Rol eliminado correctamente' });
  }),

  listPermisos: asyncHandler(async (req, res) => {
    const permisos = await roleService.listRolePermisos(req.params.uuid);
    ApiResponse.send(res, { message: 'Permisos del rol obtenidos correctamente', data: permisos });
  }),

  assignPermiso: asyncHandler(async (req, res) => {
    await roleService.assignPermiso(req.params.uuid, req.body.permisoUuid, req.user?.id);
    ApiResponse.send(res, { message: 'Permiso asignado correctamente', data: null });
  }),

  removePermiso: asyncHandler(async (req, res) => {
    await roleService.removePermiso(req.params.uuid, req.params.permisoUuid);
    ApiResponse.send(res, { message: 'Permiso removido correctamente', data: null });
  }),
};

export default roleController;
