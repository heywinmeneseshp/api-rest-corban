import { elaboracionService } from '../../services/inventario/elaboracion.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const elaboracionController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await elaboracionService.list(req.query);
    ApiResponse.send(res, { message: 'Elaboraciones obtenidas correctamente', data: { items, meta } });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const elaboracion = await elaboracionService.getByUuid(req.params.uuid);
    ApiResponse.send(res, { message: 'Elaboración obtenida correctamente', data: elaboracion });
  }),

  create: asyncHandler(async (req, res) => {
    const resultado = await elaboracionService.create(req.body, req.user?.id, {
      forzarSaldoNegativo: req.body?.forzarSaldoNegativo === true,
    });
    ApiResponse.send(res, {
      statusCode: resultado.requiereConfirmacion ? HTTP_STATUS.OK : HTTP_STATUS.CREATED,
      message: resultado.requiereConfirmacion ? 'Confirmación requerida' : 'Elaboración creada correctamente',
      data: resultado,
    });
  }),
};

export default elaboracionController;
