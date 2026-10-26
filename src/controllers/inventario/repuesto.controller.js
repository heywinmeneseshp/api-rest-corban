import { repuestoService } from '../../services/inventario/repuesto.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

export const repuestoController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await repuestoService.list(req.query, req.user);
    ApiResponse.send(res, { message: 'Repuestos obtenidos correctamente', data: { items, meta } });
  }),
  getByUuid: asyncHandler(async (req, res) => {
    const data = await repuestoService.getByUuid(req.params.uuid, req.user);
    ApiResponse.send(res, { message: 'Repuesto obtenido correctamente', data });
  }),
  listDeleted: asyncHandler(async (req, res) => {
    const { items, meta } = await repuestoService.listDeleted(req.query);
    ApiResponse.send(res, { message: 'Repuestos eliminados obtenidos correctamente', data: { items, meta } });
  }),
  restore: asyncHandler(async (req, res) => {
    const data = await repuestoService.restore(req.params.uuid);
    ApiResponse.send(res, { message: 'Repuesto restaurado correctamente', data });
  }),
  create: asyncHandler(async (req, res) => {
    const data = await repuestoService.create(req.body, req.user?.id);
    ApiResponse.send(res, { statusCode: 201, message: 'Repuesto creado correctamente', data });
  }),
  update: asyncHandler(async (req, res) => {
    const data = await repuestoService.update(req.params.uuid, req.body, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Repuesto actualizado correctamente', data });
  }),
  remove: asyncHandler(async (req, res) => {
    await repuestoService.delete(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Repuesto eliminado correctamente' });
  }),
};
