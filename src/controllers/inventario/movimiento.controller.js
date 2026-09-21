import { movimientoService } from '../../services/inventario/movimiento.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const movimientoController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await movimientoService.list(req.query);
    ApiResponse.send(res, { message: 'Movimientos obtenidos correctamente', data: { items, meta } });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const mov = await movimientoService.getByUuid(req.params.uuid);
    ApiResponse.send(res, { message: 'Movimiento obtenido correctamente', data: mov });
  }),

  create: asyncHandler(async (req, res) => {
    const resultado = await movimientoService.create(req.body, req.user?.id);
    // Salida de un artículo ELABORADO con algún insumo insuficiente: el
    // servicio no escribió nada y devuelve el mismo patrón de confirmación
    // que ya usa el resto de la app (mezcla/elaboracion/racimo) en vez del
    // movimiento creado.
    if (resultado?.requiereConfirmacion) {
      ApiResponse.send(res, { message: 'Confirmación requerida', data: resultado });
      return;
    }
    ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Movimiento creado correctamente', data: resultado });
  }),

  createTransferencia: asyncHandler(async (req, res) => {
    const result = await movimientoService.createTransferencia(req.body, req.user?.id);
    ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Transferencia creada correctamente', data: result });
  }),

  existencias: asyncHandler(async (req, res) => {
    const data = await movimientoService.getExistencias(req.query);
    ApiResponse.send(res, { message: 'Existencias obtenidas correctamente', data });
  }),

  kardex: asyncHandler(async (req, res) => {
    const data = await movimientoService.getKardex(req.query);
    ApiResponse.send(res, { message: 'Kardex obtenido correctamente', data });
  }),
};

export default movimientoController;
