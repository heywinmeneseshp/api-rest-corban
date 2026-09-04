import { evaluacionService } from '../services/agricola/evaluacion.service.js';
import { logger } from '../utils/logger.js';

// Envío automático semanal del correo de Alertas de Sanidad Vegetal, al
// iniciar la semana (lunes). El despliegue real (Docker en el VPS) es un
// proceso Node de larga duración sin ningún cron del sistema operativo —
// a diferencia de Vercel (ver vercel.json, que sí dispara
// /cron/enviar-alertas-sanidad-vegetal por HTTP en ese entorno), acá no hay
// nada externo que "toque" al servidor una vez por semana. Por eso este
// scheduler corre EN el mismo proceso: revisa una vez por hora si ya es
// lunes a la hora objetivo y todavía no se mandó hoy.
const DIA_OBJETIVO = 1; // 1 = lunes (getUTCDay())
const HORA_OBJETIVO_UTC = 6; // 06:00 UTC
const INTERVALO_CHEQUEO_MS = 60 * 60 * 1000; // cada hora

let ultimaFechaEnviada = null; // 'AAAA-MM-DD' (UTC) de la última vez que se disparó

async function chequearYEnviar() {
  const ahora = new Date();
  const hoyIso = ahora.toISOString().slice(0, 10);
  if (ahora.getUTCDay() !== DIA_OBJETIVO || ahora.getUTCHours() !== HORA_OBJETIVO_UTC) return;
  if (ultimaFechaEnviada === hoyIso) return; // ya se disparó esta hora/día

  ultimaFechaEnviada = hoyIso;
  try {
    const result = await evaluacionService.enviarAlertasSemanaCerrada({});
    logger.info('Job semanal de Alertas de Sanidad Vegetal ejecutado', {
      enviado: result.enviado,
      destinatarios: result.destinatarios.length,
      alertas: result.alertas.length,
    });
  } catch (error) {
    logger.error('Job semanal de Alertas de Sanidad Vegetal falló', { message: error.message, stack: error.stack });
  }
}

export function iniciarJobAlertasSanidadVegetal() {
  setInterval(chequearYEnviar, INTERVALO_CHEQUEO_MS);
  // Chequeo inicial al arrancar, por si el proceso justo se reinició en la
  // ventana objetivo (ej. un redeploy un lunes a esa hora).
  chequearYEnviar();
}
