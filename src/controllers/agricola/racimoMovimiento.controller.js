import { racimoMovimientoService, puedeForzarSaldoNegativo } from '../../services/agricola/racimoMovimiento.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';
import { bulkProgress } from '../../utils/bulkProgress.js';

export const racimoMovimientoController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await racimoMovimientoService.listMovimientos(req.query, req.user);
    ApiResponse.send(res, { message: 'Movimientos de racimos obtenidos correctamente', data: { items, meta } });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const movimiento = await racimoMovimientoService.getMovimientoByUuid(req.params.uuid, req.user);
    ApiResponse.send(res, { message: 'Movimiento de racimos obtenido correctamente', data: movimiento });
  }),

  create: asyncHandler(async (req, res) => {
    const resultado = await racimoMovimientoService.createMovimiento(req.body, req.user?.id, req.user);
    if (resultado.requiereLiquidarSemana) {
      return ApiResponse.send(res, {
        message: `Hay que liquidar la semana ${resultado.requiereLiquidarSemana.codigo} antes de registrar en una semana nueva`,
        data: resultado,
      });
    }
    ApiResponse.send(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Movimiento de racimos registrado correctamente',
      data: resultado.movimiento,
    });
  }),

  crearEnLote: asyncHandler(async (req, res) => {
    const resultado = await racimoMovimientoService.crearMovimientosEnLote(req.body, req.user?.id, req.user);
    if (resultado.requiereLiquidarSemana) {
      return ApiResponse.send(res, {
        message: `Hay que liquidar la semana ${resultado.requiereLiquidarSemana.codigo} antes de registrar en una semana nueva`,
        data: resultado,
      });
    }
    if (resultado.requiereConfirmacion) {
      return ApiResponse.send(res, {
        message: 'Hay líneas que dejarían el saldo de una cohorte en negativo; confirma para continuar',
        data: resultado,
      });
    }
    ApiResponse.send(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: `${resultado.movimientos.length} movimiento(s) de racimos registrados correctamente`,
      data: resultado,
    });
  }),

  remove: asyncHandler(async (req, res) => {
    await racimoMovimientoService.deleteMovimiento(req.params.uuid, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Movimiento de racimos eliminado correctamente' });
  }),

  eliminarEnLote: asyncHandler(async (req, res) => {
    const cantidad = await racimoMovimientoService.deleteMovimientosEnLote(req.body.uuids, req.user?.id, req.user);
    ApiResponse.send(res, { message: `${cantidad} movimiento(s) de racimos eliminados correctamente` });
  }),

  inventario: asyncHandler(async (req, res) => {
    const data = await racimoMovimientoService.getInventario(req.query, req.user);
    ApiResponse.send(res, { message: 'Inventario de racimos obtenido correctamente', data });
  }),

  resumenCohorte: asyncHandler(async (req, res) => {
    const data = await racimoMovimientoService.getResumenCohorte(req.query, req.user);
    ApiResponse.send(res, { message: 'Resumen de cohorte obtenido correctamente', data });
  }),

  reporteSaldos: asyncHandler(async (req, res) => {
    const data = await racimoMovimientoService.getReporteSaldos(req.query, req.user);
    ApiResponse.send(res, { message: 'Reporte de saldos obtenido correctamente', data });
  }),

  reporteEmbolses: asyncHandler(async (req, res) => {
    const data = await racimoMovimientoService.getReporteEmbolses(req.query, req.user);
    ApiResponse.send(res, { message: 'Reporte de embolses obtenido correctamente', data });
  }),

  bulkUpload: asyncHandler(async (req, res) => {
    const dryRun = req.body?.dryRun === 'true';
    const mode = req.body?.mode;
    const progressToken = req.body?.progressToken;
    const forceNegativeSaldos = req.body?.forceNegativeSaldos === 'true';
    const puedeForzar = puedeForzarSaldoNegativo(req.user);

    if (forceNegativeSaldos && !puedeForzar) {
      throw ApiError.forbidden('No tienes permiso para forzar la carga con saldos negativos');
    }

    const resultado = await racimoMovimientoService.bulkCreateMovimientos(req.file, req.user?.id, {
      dryRun,
      mode,
      progressToken,
      forceNegativeSaldos,
      esAdmin: puedeForzar,
      user: req.user,
    });
    if (progressToken) bulkProgress.remove(progressToken);
    ApiResponse.send(res, { message: 'Cargue masivo de movimientos procesado', data: resultado });
  }),

  exportar: asyncHandler(async (req, res) => {
    const buffer = await racimoMovimientoService.exportMovimientosToExcel(req.query, req.user);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="movimientos-${Date.now()}.xlsx"`);
    res.send(buffer);
  }),

  exportarReporteSemanal: asyncHandler(async (req, res) => {
    const buffer = await racimoMovimientoService.exportReporteSemanal(req.query, req.user);
    const nombres = { EMBOLSE: 'embolsados', REPIQUE: 'repicados', RECUSE: 'recusados', PROCESADO: 'procesados' };
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="registro-${nombres[req.query.tipo] || 'reporte'}-${Date.now()}.xlsx"`,
    );
    res.send(buffer);
  }),

  bulkProgress: asyncHandler(async (req, res) => {
    const { token } = req.params;
    const progreso = bulkProgress.get(token);
    if (!progreso) return ApiResponse.send(res, { data: null });
    ApiResponse.send(res, { data: progreso });
  }),
};

export default racimoMovimientoController;
