import { estimacionFincaService } from '../services/agricola/estimacionFinca.service.js';
import { logger } from '../utils/logger.js';

// Cuando pasa la hora límite de envío de estimaciones de la semana (configurable en Estimaciones → tuerca), avisa por correo a los roles y
// usuarios en copia. Revisa cada 5 minutos; el aviso sale una sola vez por semana (queda anotado en la configuración).
const INTERVALO_CHEQUEO_MS = 5 * 60 * 1000;

async function chequear() {
  try {
    const r = await estimacionFincaService.avisarLimiteVencido();
    if (r.enviado || r.vencido) logger.info('Job de límite de estimaciones ejecutado', r);
  } catch (error) {
    logger.error('Job de límite de estimaciones falló', { message: error.message, stack: error.stack });
  }
}

export function iniciarJobEstimacionLimite() {
  setInterval(chequear, INTERVALO_CHEQUEO_MS);
  chequear();
}
