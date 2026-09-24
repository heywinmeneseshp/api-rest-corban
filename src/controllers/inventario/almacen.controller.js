import { almacenService } from '../../services/inventario/almacen.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const almacenController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await almacenService.list(req.query, req.user);
    ApiResponse.send(res, { message: 'Almacenes obtenidos correctamente', data: { items, meta } });
  }),
  tree: asyncHandler(async (req, res) => {
    const items = await almacenService.listTree(req.user);
    ApiResponse.send(res, { message: 'Árbol de almacenes obtenido correctamente', data: items });
  }),
  getByUuid: asyncHandler(async (req, res) => {
    const alm = await almacenService.getByUuid(req.params.uuid, req.user);
    ApiResponse.send(res, { message: 'Almacén obtenido correctamente', data: alm });
  }),
  create: asyncHandler(async (req, res) => {
    const alm = await almacenService.create(req.body, req.user?.id);
    ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Almacén creado correctamente', data: alm });
  }),
  update: asyncHandler(async (req, res) => {
    const alm = await almacenService.update(req.params.uuid, req.body, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Almacén actualizado correctamente', data: alm });
  }),
  remove: asyncHandler(async (req, res) => {
    await almacenService.delete(req.params.uuid, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Almacén eliminado correctamente' });
  }),
};

export default almacenController;
