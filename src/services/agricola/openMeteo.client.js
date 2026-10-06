// Cliente mínimo de Open-Meteo (https://open-meteo.com/en/docs) — API pública,
// sin API key. Usa el endpoint de pronóstico (con `past_days`/rango de hasta
// ~92 días atrás, incluye los días más recientes) y el de archivo histórico
// (ERA5, con unos días de retraso) para rangos más antiguos.
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';

const DAILY = [
  'temperature_2m_max',
  'temperature_2m_min',
  'temperature_2m_mean',
  'precipitation_sum',
  'relative_humidity_2m_mean',
  'wind_speed_10m_mean',
  'wind_speed_10m_max',
  'shortwave_radiation_sum',
  'et0_fao_evapotranspiration',
].join(',');

async function pedir(base, { latitud, longitud, fechaDesde, fechaHasta }) {
  const url = new URL(base);
  url.searchParams.set('latitude', String(latitud));
  url.searchParams.set('longitude', String(longitud));
  url.searchParams.set('start_date', fechaDesde);
  url.searchParams.set('end_date', fechaHasta);
  url.searchParams.set('daily', DAILY);
  url.searchParams.set('timezone', 'America/Bogota');
  url.searchParams.set('wind_speed_unit', 'kmh');

  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) {
    throw new Error(`Open-Meteo: ${data?.reason || res.statusText}`);
  }
  const d = data.daily || {};
  return (d.time || []).map((fecha, i) => ({
    fecha,
    temperaturaMaxima: d.temperature_2m_max?.[i] ?? null,
    temperaturaMinima: d.temperature_2m_min?.[i] ?? null,
    temperatura: d.temperature_2m_mean?.[i] ?? null,
    mm: d.precipitation_sum?.[i] ?? null,
    humedadRelativa: d.relative_humidity_2m_mean?.[i] ?? null,
    vientoVelocidad: d.wind_speed_10m_mean?.[i] ?? null,
    vientoMax: d.wind_speed_10m_max?.[i] ?? null,
    radiacion: d.shortwave_radiation_sum?.[i] ?? null,
    et0: d.et0_fao_evapotranspiration?.[i] ?? null,
    // Punto de la malla al que Open-Meteo ajustó las coordenadas pedidas.
    celdaLatitud: data.latitude ?? null,
    celdaLongitud: data.longitude ?? null,
  }));
}

// Condiciones actuales de varias ubicaciones en UNA sola llamada: temperatura,
// humedad, viento y lluvia ahora (current), lluvia de hoy (daily) y lluvia de
// la última hora (4 intervalos de 15 min). Devuelve un arreglo en el mismo
// orden de `puntos` ([{ latitud, longitud }]).
async function actuales(puntos) {
  if (!puntos.length) return [];
  const url = new URL(FORECAST_URL);
  url.searchParams.set('latitude', puntos.map((p) => p.latitud).join(','));
  url.searchParams.set('longitude', puntos.map((p) => p.longitud).join(','));
  url.searchParams.set('current', 'temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation');
  url.searchParams.set('daily', 'precipitation_sum');
  url.searchParams.set('minutely_15', 'precipitation');
  url.searchParams.set('past_minutely_15', '4');
  url.searchParams.set('forecast_minutely_15', '0');
  url.searchParams.set('forecast_days', '1');
  url.searchParams.set('timezone', 'America/Bogota');
  url.searchParams.set('wind_speed_unit', 'kmh');

  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) throw new Error(`Open-Meteo: ${data?.reason || res.statusText}`);
  const lista = Array.isArray(data) ? data : [data];
  return lista.map((d) => {
    const ult = d.minutely_15?.precipitation || [];
    const ultimaHora = ult.length ? ult.slice(-4).reduce((a, v) => a + (Number(v) || 0), 0) : null;
    return {
      medidoEn: d.current?.time || null,
      temperatura: d.current?.temperature_2m ?? null,
      humedadRelativa: d.current?.relative_humidity_2m ?? null,
      vientoKmh: d.current?.wind_speed_10m ?? null,
      lluviaHoyMm: d.daily?.precipitation_sum?.[0] ?? null,
      lluviaUltimaHoraMm: ultimaHora,
      celdaLatitud: d.latitude ?? null,
      celdaLongitud: d.longitude ?? null,
    };
  });
}

export const openMeteoClient = {
  actuales,
  // Rango reciente (hasta ~92 días atrás): endpoint de pronóstico.
  reciente(args) {
    return pedir(FORECAST_URL, args);
  },
  // Rango antiguo: archivo histórico.
  archivo(args) {
    return pedir(ARCHIVE_URL, args);
  },
};

export default openMeteoClient;
