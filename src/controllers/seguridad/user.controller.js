import { userService } from '../../services/seguridad/user.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const userController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await userService.listUsers(req.query);
    ApiResponse.send(res, { message: 'Usuarios obtenidos correctamente', data: { items, meta } });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const user = await userService.getUserByUuid(req.params.uuid);
    ApiResponse.send(res, { message: 'Usuario obtenido correctamente', data: user });
  }),

  create: asyncHandler(async (req, res) => {
    const user = await userService.createUser(req.body, req.user?.id);
    ApiResponse.send(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Usuario creado correctamente',
      data: user,
    });
  }),

  update: asyncHandler(async (req, res) => {
    const user = await userService.updateUser(req.params.uuid, req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Usuario actualizado correctamente', data: user });
  }),

  remove: asyncHandler(async (req, res) => {
    await userService.deleteUser(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Usuario eliminado correctamente' });
  }),

  listRoles: asyncHandler(async (req, res) => {
    const roles = await userService.listUserRoles(req.params.uuid);
    ApiResponse.send(res, { message: 'Roles del usuario obtenidos correctamente', data: roles });
  }),

  assignRole: asyncHandler(async (req, res) => {
    await userService.assignRole(req.params.uuid, req.body.roleUuid, req.user?.id);
    ApiResponse.send(res, { message: 'Rol asignado correctamente', data: null });
  }),

  removeRole: asyncHandler(async (req, res) => {
    await userService.removeRole(req.params.uuid, req.params.roleUuid);
    ApiResponse.send(res, { message: 'Rol removido correctamente', data: null });
  }),

  listFincas: asyncHandler(async (req, res) => {
    const fincas = await userService.listUserFincas(req.params.uuid);
    ApiResponse.send(res, { message: 'Fincas del usuario obtenidas correctamente', data: fincas });
  }),

  assignFinca: asyncHandler(async (req, res) => {
    await userService.assignFinca(req.params.uuid, req.body.fincaUuid, req.user?.id);
    ApiResponse.send(res, { message: 'Finca asignada correctamente', data: null });
  }),

  removeFinca: asyncHandler(async (req, res) => {
    await userService.removeFinca(req.params.uuid, req.params.fincaUuid);
    ApiResponse.send(res, { message: 'Finca removida correctamente', data: null });
  }),
};

export default userController;
