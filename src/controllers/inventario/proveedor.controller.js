import { proveedorService } from '../../services/inventario/proveedor.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const proveedorController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await proveedorService.list(req.query);
    ApiResponse.send(res, { message: 'Proveedores obtenidos correctamente', data: { items, meta } });
  }),
  getByUuid: asyncHandler(async (req, res) => {
    const proveedor = await proveedorService.getByUuid(req.params.uuid);
    ApiResponse.send(res, { message: 'Proveedor obtenido correctamente', data: proveedor });
  }),
  create: asyncHandler(async (req, res) => {
    const proveedor = await proveedorService.create(req.body, req.user?.id);
    ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Proveedor creado correctamente', data: proveedor });
  }),
  update: asyncHandler(async (req, res) => {
    const proveedor = await proveedorService.update(req.params.uuid, req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Proveedor actualizado correctamente', data: proveedor });
  }),
  remove: asyncHandler(async (req, res) => {
    await proveedorService.delete(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Proveedor eliminado correctamente' });
  }),
};

export default proveedorController;
