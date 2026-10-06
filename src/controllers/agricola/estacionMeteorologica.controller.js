import { estacionMeteorologicaService } from '../../services/agricola/estacionMeteorologica.service.js';
import { openMeteoService } from '../../services/agricola/openMeteo.service.js';
import { configuracionService } from '../../services/sistema/configuracion.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const estacionMeteorologicaController = {
  actual: asyncHandler(async (req, res) => {
    const data = await estacionMeteorologicaService.obtenerActual();
    ApiResponse.send(res, { message: 'Condiciones actuales obtenidas correctamente', data });
  }),

  // Estado de conexión (¿más de 24 h sin datos?) — lo muestra el modal de
  // configuración de alertas.
  estadoConexion: asyncHandler(async (req, res) => {
    const data = await estacionMeteorologicaService.verificarSinDatos();
    ApiResponse.send(res, { message: 'Estado de la estación obtenido correctamente', data });
  }),

  // ─── Open-Meteo (clima por finca) ───
  openMeteoFincas: asyncHandler(async (req, res) => {
    const data = await openMeteoService.fincasConCoordenadas(req.user);
    ApiResponse.send(res, { message: 'Fincas obtenidas correctamente', data });
  }),

  openMeteoActuales: asyncHandler(async (req, res) => {
    const data = await openMeteoService.actuales(req.user);
    ApiResponse.send(res, { message: 'Condiciones actuales (Open-Meteo) obtenidas correctamente', data });
  }),

  openMeteoListar: asyncHandler(async (req, res) => {
    const { fincaUuids, fechaDesde, fechaHasta } = req.query;
    const items = await openMeteoService.listar(
      { fincaUuids: fincaUuids ? String(fincaUuids).split(',').filter(Boolean) : [], fechaDesde, fechaHasta },
      req.user,
    );
    ApiResponse.send(res, { message: 'Clima de Open-Meteo obtenido correctamente', data: { items } });
  }),

  openMeteoActualizar: asyncHandler(async (req, res) => {
    const data = await openMeteoService.actualizar(req.body || {}, req.user?.id);
    ApiResponse.send(res, {
      message: `Open-Meteo actualizado: ${data.fincas.length} finca(s)${data.errores.length ? `, ${data.errores.length} con error` : ''}`,
      data,
    });
  }),

  openMeteoActualizarFaltantes: asyncHandler(async (req, res) => {
    const data = await openMeteoService.actualizarFaltantes(req.user);
    ApiResponse.send(res, { message: `Open-Meteo: ${data.fincas.length} finca(s) rellenadas`, data });
  }),

  openMeteoGetConfig: asyncHandler(async (req, res) => {
    const data = await configuracionService.getOpenMeteoConfig();
    ApiResponse.send(res, { message: 'Configuración de Open-Meteo obtenida correctamente', data });
  }),

  openMeteoSetConfig: asyncHandler(async (req, res) => {
    const data = await configuracionService.setOpenMeteoConfig({ frecuencia: req.body.frecuencia }, req.user?.id);
    ApiResponse.send(res, { message: 'Configuración de Open-Meteo guardada correctamente', data });
  }),

  getUcBases: asyncHandler(async (req, res) => {
    const data = await configuracionService.getEstacionUcBases();
    ApiResponse.send(res, { message: 'Bases de unidades calóricas obtenidas correctamente', data });
  }),

  setUcBases: asyncHandler(async (req, res) => {
    const data = await configuracionService.setEstacionUcBases(req.body.bases, req.user?.id);
    ApiResponse.send(res, { message: 'Bases de unidades calóricas guardadas correctamente', data });
  }),

  getAlertaDestinatarios: asyncHandler(async (req, res) => {
    const data = await configuracionService.getEstacionAlertaDestinatarios();
    ApiResponse.send(res, { message: 'Destinatarios obtenidos correctamente', data });
  }),

  setAlertaDestinatarios: asyncHandler(async (req, res) => {
    const data = await configuracionService.setEstacionAlertaDestinatarios(req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Destinatarios guardados correctamente', data });
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
