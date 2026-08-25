import { proformaService } from '../../services/inventario/proforma.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const proformaController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await proformaService.list(req.query);
    ApiResponse.send(res, { message: 'Proformas obtenidas correctamente', data: { items, meta } });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const proforma = await proformaService.getByUuid(req.params.uuid);
    ApiResponse.send(res, { message: 'Proforma obtenida correctamente', data: proforma });
  }),

  create: asyncHandler(async (req, res) => {
    const proforma = await proformaService.create(req.body, req.user?.id);
    ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Proforma creada correctamente', data: proforma });
  }),

  update: asyncHandler(async (req, res) => {
    const proforma = await proformaService.update(req.params.uuid, req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Proforma actualizada correctamente', data: proforma });
  }),

  remove: asyncHandler(async (req, res) => {
    await proformaService.delete(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Proforma eliminada correctamente' });
  }),

  convertir: asyncHandler(async (req, res) => {
    const result = await proformaService.convertir(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Proforma convertida correctamente (preparada para factura)', data: result });
  }),
};

export default proformaController;
