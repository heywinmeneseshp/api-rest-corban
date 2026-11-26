// Lluvia de la estación meteorológica conectada (WeatherLink) como dato OFICIAL de precipitación de las fincas que la usan
// (Estación Meteorológica → Configuración → Estaciones, tabla estacion_meteorologica_fincas). Open-Meteo NO cuenta: solo
// estaciones conectadas. Si la estación tiene el dato de un día:
// - no se le pide ese día a la finca (Precipitación diaria);
// - el valor de la estación queda en Clima (dato del analista) y en Precipitación diaria, aunque la finca haya reportado otro.
import { Op } from 'sequelize';
import { sequelize } from '../../database/connection.js';
import { PrecipitacionDiaria, Semana } from '../../database/associations.js';
import { climaService } from './clima.service.js';
import { logger } from '../../utils/logger.js';

const aIso = (f) => (f instanceof Date ? f.toISOString().slice(0, 10) : String(f).slice(0, 10));

// Map fincaUuid -> id de su estación (solo estaciones activas).
export async function estacionesPorFinca() {
  const filas = await sequelize.query(
    `SELECT f.uuid AS fincaUuid, f.nombre AS fincaNombre, a.estacion_id AS estacionId
       FROM estacion_meteorologica_fincas a
       JOIN estaciones_meteorologicas e ON e.id = a.estacion_id AND e.deleted_at IS NULL AND e.estado = 1
       JOIN fincas f ON f.id = a.finca_id AND f.deleted_at IS NULL`,
    { type: 'SELECT' },
  );
  return new Map(filas.map((f) => [f.fincaUuid, { estacionId: Number(f.estacionId), fincaNombre: f.fincaNombre }]));
}

// Lluvia de la estación de una finca en unas fechas: Map fecha -> mm (solo los días con dato). Vacío si la finca no tiene estación.
export async function lluviaEstacionDeFinca(fincaUuid, { desde, hasta } = {}, mapa = null) {
  const asign = (mapa || (await estacionesPorFinca())).get(fincaUuid);
  if (!asign) return new Map();
  const filas = await sequelize.query(
    `SELECT fecha, mm FROM estacion_clima_diaria WHERE estacion = :estacion AND mm IS NOT NULL
        ${desde ? 'AND fecha >= :desde' : ''} ${hasta ? 'AND fecha <= :hasta' : ''}`,
    { replacements: { estacion: asign.estacionId, desde, hasta }, type: 'SELECT' },
  );
  return new Map(filas.map((r) => [aIso(r.fecha), Number(r.mm)]));
}

// Deja el mm de la estación en Clima y en Precipitación diaria para esa finca y fecha (crea la fila de Clima si no existe).
export async function aplicarLluviaEstacion(fincaUuid, fincaNombre, fecha, mm) {
  const registroClima = await climaService.getByFincaFecha(fincaUuid, fecha);
  if (registroClima) {
    if (registroClima.mm === null || Number(registroClima.mm) !== Number(mm)) {
      await sequelize.query('UPDATE clima SET mm = :mm WHERE uuid = :uuid', { replacements: { mm, uuid: registroClima.uuid } });
    }
  } else {
    const semana = await Semana.findOne({ where: { fechaInicio: { [Op.lte]: fecha }, fechaFin: { [Op.gte]: fecha } } });
    if (semana) {
      await climaService.create(
        { fincaUuid, fincaNombre, semanaUuid: semana.uuid, semanaCodigo: semana.codigo, fecha, mm, usuarioNombre: 'Estación meteorológica' },
        null,
      );
    }
  }
  await PrecipitacionDiaria.update({ mm, coincideClima: true }, { where: { fincaUuid, fecha } });
}

// Tras sincronizar una estación en unas fechas: aplica su lluvia a todas las fincas que la usan. No lanza errores.
export async function aplicarEstacionEnFechas(estacionId, fechas) {
  try {
    const mapa = await estacionesPorFinca();
    const fincas = [...mapa.entries()].filter(([, a]) => a.estacionId === Number(estacionId));
    if (!fincas.length || !fechas.length) return;
    const filas = await sequelize.query(
      'SELECT fecha, mm FROM estacion_clima_diaria WHERE estacion = :estacion AND mm IS NOT NULL AND fecha IN (:fechas)',
      { replacements: { estacion: Number(estacionId), fechas }, type: 'SELECT' },
    );
    for (const r of filas) {
      for (const [fincaUuid, a] of fincas) await aplicarLluviaEstacion(fincaUuid, a.fincaNombre, aIso(r.fecha), Number(r.mm));
    }
  } catch (error) {
    logger.error('No se pudo aplicar la lluvia de la estación a sus fincas', { message: error.message, estacionId });
  }
}
