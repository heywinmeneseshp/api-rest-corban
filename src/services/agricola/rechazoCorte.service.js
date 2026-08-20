import { rechazoCorteRepository } from '../../repositories/agricola/rechazoCorte.repository.js';
import { cargarCatalogos, resolverProductosPorNombre, esSemanaAnterior } from './programacionCorte.service.js';
import { Semana } from '../../database/associations.js';
import { sequelize } from '../../database/connection.js';
import { ApiError } from '../../utils/ApiError.js';
import { configuracionService } from '../sistema/configuracion.service.js';
import { logger } from '../../utils/logger.js';

// Recibe (vía webhook, ver requireApiKey.middleware.js) el listado completo
// de Rechazos ACTIVOS de una semana desde api-rest-banarica, y reemplaza por
// completo lo que Corbana tenía guardado de esa semana — mismo criterio que
// programacionCorteService.reemplazarFilasSemana: no tiene sentido "omitir",
// si Logística ya no tiene un rechazo que antes sí tenía (se eliminó,
// restauró o cambió de cantidad), el espejo debe reflejar eso tal cual.
//
// Solo se guarda si la semana ya existe en Corbana Y es igual o posterior a
// la primera semana a la que se le cargó Programación de Corte alguna vez
// (ver programacionCorteService.actualizarPrimeraSemanaSiAplica) — semanas
// más viejas quedaron fuera del seguimiento de Corbana desde antes de que
// existiera esta integración, y no tiene sentido empezar a rastrear sus
// rechazos ahora. En ambos casos de "no aplica" se responde OK sin guardar
// nada (silencioso, ver AskUserQuestion confirmado con el usuario).
async function syncSemanaWebhook(semanaCodigo, rechazos) {
  if (!semanaCodigo) throw ApiError.badRequest('Debes indicar la semana');
  if (!Array.isArray(rechazos)) throw ApiError.badRequest('Debes indicar el listado de rechazos');

  const semana = await Semana.findOne({ where: { codigo: semanaCodigo } });
  if (!semana) return { aplicado: false, motivo: 'Semana no encontrada en Corbana' };

  const primeraSemanaId = await configuracionService.getPrimeraSemanaProgramacionId();
  if (!primeraSemanaId) return { aplicado: false, motivo: 'Corbana todavía no tiene ninguna semana con Programación de Corte' };

  const primeraSemana = await Semana.findByPk(primeraSemanaId, { attributes: ['anio', 'numeroSemana'] });
  if (primeraSemana && esSemanaAnterior(semana, primeraSemana)) {
    return { aplicado: false, motivo: 'Semana anterior al inicio del seguimiento de Programación de Corte en Corbana' };
  }

  const { fincaPorCodigo } = await cargarCatalogos();

  const filasValidas = [];
  const omitidas = [];
  for (const r of rechazos) {
    const fincaCodigo = String(r.fincaCodigo || '').trim().toUpperCase();
    const fincaId = fincaPorCodigo.get(fincaCodigo);
    if (!fincaId) {
      omitidas.push({ fincaCodigo, motivo: 'Finca no encontrada en Corbana' });
      continue;
    }
    filasValidas.push({ ...r, fincaId });
  }

  const nombresProducto = [...new Set(filasValidas.map((f) => String(f.productoNombre || '').trim()).filter(Boolean))];
  const productoPorNombre = await resolverProductosPorNombre(nombresProducto, null);

  const aInsertar = filasValidas
    .filter((f) => !Number.isNaN(new Date(f.fechaRechazo).getTime()))
    .map((f) => ({
      fechaRechazo: new Date(f.fechaRechazo).toISOString().slice(0, 10),
      // fechaCorte (fecha real de cosecha, viene como "fechaLlenado" del
      // lado de Logística — fecha de llenado del contenedor) puede no venir
      // si Logística no encontró el listado exacto de ese rechazo (ver
      // rechazo.service.js#_avisarCorbanaRechazos en api-rest-banarica).
      fechaCorte: f.fechaLlenado && !Number.isNaN(new Date(f.fechaLlenado).getTime())
        ? new Date(f.fechaLlenado).toISOString().slice(0, 10)
        : null,
      fincaId: f.fincaId,
      semanaId: semana.id,
      productoId: productoPorNombre.get(String(f.productoNombre || '').trim()) || null,
      cajas: Math.round(Number(f.cajas) || 0),
      motivo: f.motivo || null,
    }));

  await sequelize.transaction(async (transaction) => {
    await rechazoCorteRepository.deleteBySemana(semana.id, { transaction });
    if (aInsertar.length > 0) {
      await rechazoCorteRepository.bulkCreate(aInsertar, { transaction });
    }
  });

  if (omitidas.length > 0) {
    logger.warn('Rechazos de Logística con finca no encontrada en Corbana', { semanaCodigo, omitidas });
  }

  return { aplicado: true, creados: aInsertar.length, omitidos: omitidas.length };
}

export const rechazoCorteService = {
  syncSemanaWebhook,

  async getResumenPorSemana(semanaUuid) {
    const semana = await Semana.findOne({ where: { uuid: semanaUuid } });
    if (!semana) throw ApiError.notFound('Semana no encontrada');
    const totales = await rechazoCorteRepository.sumarCajasPorFincaYSemana(semana.id);
    return totales.map((t) => ({ fincaId: t.fincaId, totalCajas: Number(t.totalCajas) }));
  },
};

export default rechazoCorteService;
