import { racimoMovimientoService } from '../../services/agricola/racimoMovimiento.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const racimoMovimientoController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await racimoMovimientoService.listMovimientos(req.query);
    ApiResponse.send(res, { message: 'Movimientos de racimos obtenidos correctamente', data: { items, meta } });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const movimiento = await racimoMovimientoService.getMovimientoByUuid(req.params.uuid);
    ApiResponse.send(res, { message: 'Movimiento de racimos obtenido correctamente', data: movimiento });
  }),

  create: asyncHandler(async (req, res) => {
    const movimiento = await racimoMovimientoService.createMovimiento(req.body, req.user?.id);
    ApiResponse.send(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Movimiento de racimos registrado correctamente',
      data: movimiento,
    });
  }),

  remove: asyncHandler(async (req, res) => {
    await racimoMovimientoService.deleteMovimiento(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Movimiento de racimos eliminado correctamente' });
  }),

  inventario: asyncHandler(async (req, res) => {
    const data = await racimoMovimientoService.getInventario(req.query);
    ApiResponse.send(res, { message: 'Inventario de racimos obtenido correctamente', data });
  }),

  resumenCohorte: asyncHandler(async (req, res) => {
    const data = await racimoMovimientoService.getResumenCohorte(req.query);
    ApiResponse.send(res, { message: 'Resumen de cohorte obtenido correctamente', data });
  }),
};

export default racimoMovimientoController;
