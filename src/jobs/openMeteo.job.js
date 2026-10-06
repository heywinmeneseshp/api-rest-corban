import { openMeteoService } from '../services/agricola/openMeteo.service.js';
import { logger } from '../utils/logger.js';

// Actualización automática de Open-Meteo según la frecuencia configurada
// (diaria, semanal o mensual). Mismo esquema que los demás jobs: proceso
// Node de larga duración, chequeo cada hora; solo actúa a partir de las 5 a.m.
// hora Colombia y si ya toca según la última actualización.
const HORA_MINIMA_BOGOTA = 5;
const INTERVALO_CHEQUEO_MS = 60 * 60 * 1000;
const ZONA = 'America/Bogota';

let ejecutando = false;

async function chequear() {
  const hora = Number(new Intl.DateTimeFormat('en-GB', { timeZone: ZONA, hour: '2-digit', hour12: false }).format(new Date()));
  if (hora < HORA_MINIMA_BOGOTA || ejecutando) return;

  ejecutando = true;
  try {
    const r = await openMeteoService.actualizarSiCorresponde();
    if (r.actualizado) {
      logger.info('Open-Meteo actualizado automáticamente', { fincas: r.fincas.length, errores: r.errores.length });
    }
  } catch (error) {
    logger.error('Actualización automática de Open-Meteo falló', { message: error.message, stack: error.stack });
  } finally {
    ejecutando = false;
  }
}

export function iniciarJobOpenMeteo() {
  setInterval(chequear, INTERVALO_CHEQUEO_MS);
  chequear();
}
