import { comprobanteAspersionService } from '../../services/agricola/comprobanteAspersion.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const comprobanteAspersionController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await comprobanteAspersionService.list(req.query, req.user);
    ApiResponse.send(res, { message: 'Comprobantes de aspersión obtenidos correctamente', data: { items, meta } });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const comprobante = await comprobanteAspersionService.getByUuid(req.params.uuid, req.user);
    ApiResponse.send(res, { message: 'Comprobante de aspersión obtenido correctamente', data: comprobante });
  }),

  update: asyncHandler(async (req, res) => {
    const comprobante = await comprobanteAspersionService.update(req.params.uuid, req.body, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Comprobante de aspersión actualizado correctamente', data: comprobante });
  }),

  emitir: asyncHandler(async (req, res) => {
    const comprobante = await comprobanteAspersionService.emitir(req.params.uuid, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Comprobante de aspersión emitido correctamente', data: comprobante });
  }),

  remove: asyncHandler(async (req, res) => {
    const resultado = await comprobanteAspersionService.remove(req.params.uuid, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Borrador de comprobante eliminado correctamente', data: resultado });
  }),
};

export default comprobanteAspersionController;
