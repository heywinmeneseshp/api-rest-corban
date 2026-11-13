import { mantenimientoAvisosService } from '../services/inventario/mantenimientoAvisos.service.js';
import { logger } from '../utils/logger.js';

// Aviso diario (desde las 7:00 a.m. de Bogotá) de mantenimientos programados próximos o vencidos. Cada estado se avisa una sola vez por
// programación (columna aviso_estado), así que revisar cada hora no repite correos.
const HORA_OBJETIVO_UTC = 12;
const INTERVALO_MS = 60 * 60 * 1000;
let ultimoDia = null;

async function chequear() {
  const ahora = new Date();
  const hoy = ahora.toISOString().slice(0, 10);
  if (ahora.getUTCHours() < HORA_OBJETIVO_UTC || ultimoDia === hoy) return;
  try {
    const r = await mantenimientoAvisosService.avisarProgramaciones();
    logger.info('Job de mantenimientos programados ejecutado', r);
    ultimoDia = hoy;
  } catch (error) {
    logger.error('Job de mantenimientos programados falló', { message: error.message, stack: error.stack });
  }
}

export function iniciarJobMantenimientoProgramado() {
  setInterval(chequear, INTERVALO_MS);
  chequear();
}
