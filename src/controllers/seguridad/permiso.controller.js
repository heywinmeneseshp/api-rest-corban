import { permisoService } from '../../services/seguridad/permiso.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const permisoController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await permisoService.listPermisos(req.query);
    ApiResponse.send(res, { message: 'Permisos obtenidos correctamente', data: { items, meta } });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const permiso = await permisoService.getPermisoByUuid(req.params.uuid);
    ApiResponse.send(res, { message: 'Permiso obtenido correctamente', data: permiso });
  }),

  create: asyncHandler(async (req, res) => {
    const permiso = await permisoService.createPermiso(req.body, req.user?.id);
    ApiResponse.send(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Permiso creado correctamente',
      data: permiso,
    });
  }),

  update: asyncHandler(async (req, res) => {
    const permiso = await permisoService.updatePermiso(req.params.uuid, req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Permiso actualizado correctamente', data: permiso });
  }),

  remove: asyncHandler(async (req, res) => {
    await permisoService.deletePermiso(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Permiso eliminado correctamente' });
  }),
};

export default permisoController;
