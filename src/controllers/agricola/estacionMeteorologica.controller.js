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

  // Sincronización manual puntual (por defecto, el día de ayer) — el cron
  // diario (ver cron.controller.js) hace lo mismo automáticamente.
  sincronizar: asyncHandler(async (req, res) => {
    const fecha = req.body?.fecha || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const fila = await estacionMeteorologicaService.sincronizarFecha(fecha);
    ApiResponse.send(res, { message: `Estación sincronizada para ${fecha}`, data: fila });
  }),
};

export default estacionMeteorologicaController;
