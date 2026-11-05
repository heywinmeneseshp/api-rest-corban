import { asistenciaService } from '../services/agricola/asistencia.service.js';
import { logger } from '../utils/logger.js';

// Correo diario a los colaboradores que dejaron incompleta una jornada. Sale desde las 10:00 a.m. de Bogotá: para entonces ya subieron
// las marcaciones hechas sin internet y venció el plazo de 16 h de los turnos que cruzan la medianoche.
// No depende de estar encendido justo a esa hora: al arrancar o en la siguiente revisión se ponen al día los últimos días. La tabla
// asistencia_avisos_jornada evita repetir un aviso, y si un envío falla se reintenta en la siguiente hora.
const HORA_OBJETIVO_UTC = 15; // 10:00 Bogotá
const INTERVALO_CHEQUEO_MS = 60 * 60 * 1000;
const DIAS_RECUPERACION = 3; // pasado este tiempo el aviso ya no sirve
const PRIMERA_FECHA = '2026-11-05'; // jornadas anteriores a la puesta en marcha no se avisan
const MS_DIA = 86400000;

let ultimaFechaCompleta = null;

const diaBogota = (ms) => new Date(ms - 5 * 3600 * 1000).toISOString().slice(0, 10);

async function chequearYEnviar() {
  const ahora = new Date();
  const hoyIso = ahora.toISOString().slice(0, 10);
  if (ahora.getUTCHours() < HORA_OBJETIVO_UTC || ultimaFechaCompleta === hoyIso) return;

  try {
    let fallidos = 0;
    for (let i = DIAS_RECUPERACION; i >= 1; i -= 1) {
      const fecha = diaBogota(ahora.getTime() - i * MS_DIA);
      if (fecha < PRIMERA_FECHA) continue;
      const r = await asistenciaService.enviarAvisosJornadaIncompleta(fecha);
      fallidos += r.fallidos;
      logger.info('Job de jornadas incompletas ejecutado', r);
    }
    if (!fallidos) ultimaFechaCompleta = hoyIso;
  } catch (error) {
    logger.error('Job de jornadas incompletas falló', { message: error.message, stack: error.stack });
  }
}

export function iniciarJobJornadaIncompleta() {
  setInterval(chequearYEnviar, INTERVALO_CHEQUEO_MS);
  chequearYEnviar();
}
