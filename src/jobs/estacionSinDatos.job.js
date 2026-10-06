import { estacionMeteorologicaService } from '../services/agricola/estacionMeteorologica.service.js';
import { logger } from '../utils/logger.js';

// Revisión diaria, a las 6:00 a.m. hora Colombia, de si la Estación
// Meteorológica lleva más de 24 horas sin enviar datos; si es así, manda la
// alerta por correo a los destinatarios configurados (ver
// estacionMeteorologica.service.js#enviarAlertaSinDatos). Mismo esquema que
// alertasSanidadVegetal.job.js: el VPS es un proceso Node de larga duración
// sin cron del sistema, así que el scheduler corre en el propio proceso
// (chequeo cada 10 min; dispara la primera vez que ve las 6 a.m. de hoy).
const HORA_OBJETIVO_BOGOTA = 6;
const INTERVALO_CHEQUEO_MS = 10 * 60 * 1000;
const ZONA = 'America/Bogota';

let ultimaFechaRevisada = null; // 'AAAA-MM-DD' (Bogotá) de la última revisión

function ahoraBogota() {
  const fecha = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const hora = Number(new Intl.DateTimeFormat('en-GB', { timeZone: ZONA, hour: '2-digit', hour12: false }).format(new Date()));
  return { fecha, hora };
}

async function chequear() {
  const { fecha, hora } = ahoraBogota();
  if (hora !== HORA_OBJETIVO_BOGOTA || ultimaFechaRevisada === fecha) return;

  ultimaFechaRevisada = fecha;
  try {
    const r = await estacionMeteorologicaService.enviarAlertaSinDatos();
    logger.info('Revisión diaria de la estación meteorológica', {
      sinDatos: r.sinDatos,
      horasSinDatos: r.horasSinDatos,
      enviado: r.enviado,
      destinatarios: r.destinatarios.length,
    });
  } catch (error) {
    logger.error('Revisión diaria de la estación meteorológica falló', { message: error.message, stack: error.stack });
  }
}

export function iniciarJobEstacionSinDatos() {
  setInterval(chequear, INTERVALO_CHEQUEO_MS);
  chequear();
}
