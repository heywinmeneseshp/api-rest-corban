import { articuloService } from '../../services/inventario/articulo.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const articuloController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await articuloService.list(req.query);
    ApiResponse.send(res, { message: 'Artículos obtenidos correctamente', data: { items, meta } });
  }),
  getByUuid: asyncHandler(async (req, res) => {
    const art = await articuloService.getByUuid(req.params.uuid);
    ApiResponse.send(res, { message: 'Artículo obtenido correctamente', data: art });
  }),
  listDeleted: asyncHandler(async (req, res) => {
    const { items, meta } = await articuloService.listDeleted(req.query);
    ApiResponse.send(res, { message: 'Artículos eliminados obtenidos correctamente', data: { items, meta } });
  }),
  restore: asyncHandler(async (req, res) => {
    const art = await articuloService.restore(req.params.uuid);
    ApiResponse.send(res, { message: 'Artículo restaurado correctamente', data: art });
  }),
  create: asyncHandler(async (req, res) => {
    const art = await articuloService.create(req.body, req.user?.id);
    ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Artículo creado correctamente', data: art });
  }),
  update: asyncHandler(async (req, res) => {
    const art = await articuloService.update(req.params.uuid, req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Artículo actualizado correctamente', data: art });
  }),
  remove: asyncHandler(async (req, res) => {
    await articuloService.delete(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Artículo eliminado correctamente' });
  }),
  bulkUpload: asyncHandler(async (req, res) => {
    const dryRun = req.body?.dryRun === 'true';
    const resultado = await articuloService.bulkCreateArticulos(req.file, req.user?.id, { dryRun });
    ApiResponse.send(res, { message: 'Cargue masivo de artículos procesado', data: resultado });
  }),
  exportar: asyncHandler(async (req, res) => {
    const buffer = await articuloService.exportArticulosToExcel();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="articulos-${Date.now()}.xlsx"`);
    res.send(buffer);
  }),
};

export default articuloController;
