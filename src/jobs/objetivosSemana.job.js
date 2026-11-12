import { objetivoEvaluacionService } from '../services/agricola/objetivoEvaluacion.service.js';
import { logger } from '../utils/logger.js';

// Domingo en la noche (desde las 8:00 p. m. de Bogotá): correo con las fincas que no cumplieron los objetivos de evaluación de la semana.
// Revisa cada 15 minutos; el aviso sale una sola vez por semana (queda anotado en la configuración), así que un reinicio no lo repite y si el
// servidor estaba apagado a esa hora se envía al volver a arrancar ese mismo domingo.
const HORA_BOGOTA = 20;
const INTERVALO_CHEQUEO_MS = 15 * 60 * 1000;

async function chequear() {
  const bogota = new Date(Date.now() - 5 * 3600000);
  if (bogota.getUTCDay() !== 0 || bogota.getUTCHours() < HORA_BOGOTA) return;
  try {
    const r = await objetivoEvaluacionService.avisarIncumplimientoSemana();
    if (r.enviado) logger.info('Aviso semanal de objetivos de evaluación enviado', r);
  } catch (error) {
    logger.error('Aviso semanal de objetivos de evaluación falló', { message: error.message, stack: error.stack });
  }
}

export function iniciarJobObjetivosSemana() {
  setInterval(chequear, INTERVALO_CHEQUEO_MS);
  chequear();
}
