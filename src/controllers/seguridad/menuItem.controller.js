import { menuItemService } from '../../services/seguridad/menuItem.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const menuItemController = {
  getTree: asyncHandler(async (req, res) => {
    const tree = await menuItemService.getMenuTree(req.user?.permissions || []);
    ApiResponse.send(res, { message: 'Menú obtenido correctamente', data: tree });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const menuItem = await menuItemService.getMenuItemByUuid(req.params.uuid);
    ApiResponse.send(res, { message: 'Ítem de menú obtenido correctamente', data: menuItem });
  }),

  create: asyncHandler(async (req, res) => {
    const menuItem = await menuItemService.createMenuItem(req.body, req.user?.id);
    ApiResponse.send(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Ítem de menú creado correctamente',
      data: menuItem,
    });
  }),

  update: asyncHandler(async (req, res) => {
    const menuItem = await menuItemService.updateMenuItem(req.params.uuid, req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Ítem de menú actualizado correctamente', data: menuItem });
  }),

  remove: asyncHandler(async (req, res) => {
    await menuItemService.deleteMenuItem(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Ítem de menú eliminado correctamente' });
  }),
};

export default menuItemController;
