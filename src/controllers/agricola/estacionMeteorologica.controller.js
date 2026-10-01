import { estacionMeteorologicaService } from '../../services/agricola/estacionMeteorologica.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const estacionMeteorologicaController = {
  actual: asyncHandler(async (req, res) => {
    const data = await estacionMeteorologicaService.obtenerActual();
    ApiResponse.send(res, { message: 'Condiciones actuales obtenidas correctamente', data });
  }),

  historico: asyncHandler(async (req, res) => {
    const items = await estacionMeteorologicaService.listarHistorico(req.query);
    ApiResponse.send(res, { message: 'Histórico obtenido correctamente', data: { items } });
  }),

  // Sincronización manual — un día puntual (`fecha`), un rango
  // (`fechaDesde`/`fechaHasta`), o por defecto (sin nada en el body) el día
  // de ayer. El cron diario (ver cron.controller.js) usa el default.
  sincronizar: asyncHandler(async (req, res) => {
    const { fecha, fechaDesde, fechaHasta } = req.body || {};

    if (fechaDesde && fechaHasta) {
      const resultado = await estacionMeteorologicaService.sincronizarRango(fechaDesde, fechaHasta);
      ApiResponse.send(res, {
        message: `Sincronizados ${resultado.sincronizados.length} día(s)${resultado.errores.length ? `, ${resultado.errores.length} con error` : ''}`,
        data: resultado,
      });
      return;
    }

    const fechaFinal = fecha || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const fila = await estacionMeteorologicaService.sincronizarFecha(fechaFinal);
    ApiResponse.send(res, { message: `Estación sincronizada para ${fechaFinal}`, data: fila });
  }),

  // Llamado al abrir el módulo (ver estacion-meteorologica/page.js) — rellena
  // en silencio los días del último mes que todavía no tienen dato.
  sincronizarFaltantes: asyncHandler(async (req, res) => {
    const resultado = await estacionMeteorologicaService.sincronizarFaltantes();
    ApiResponse.send(res, {
      message: resultado.sincronizados.length
        ? `Se rellenaron ${resultado.sincronizados.length} día(s) faltante(s)`
        : 'No había días faltantes en el último mes',
      data: resultado,
    });
  }),
};

export default estacionMeteorologicaController;
