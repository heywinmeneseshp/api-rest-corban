import rrulePkg from 'rrule';

const { RRule } = rrulePkg;

// Tope de seguridad para series "nunca termina" — evita generar miles de
// filas por accidente. En modo SIMULTANEO aplica por lote (cada lote genera
// hasta este número de ocurrencias).
export const MAX_OCURRENCIAS = 500;

// Horizonte de materialización para series sin fecha de fin: se generan
// ocurrencias hasta 2 años adelante; si a futuro se pide una vista más allá
// de este horizonte, se debe extender bajo demanda (no implementado en
// fase 1).
const HORIZON_MESES = 24;

const FREQ_MAP = {
  DIARIA: RRule.DAILY,
  SEMANAL: RRule.WEEKLY,
  MENSUAL: RRule.MONTHLY,
  ANUAL: RRule.YEARLY,
};

function toUtcDate(fechaIso) {
  const [y, m, d] = fechaIso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toIsoDate(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addMeses(date, meses) {
  const result = new Date(date.getTime());
  result.setUTCMonth(result.getUTCMonth() + meses);
  return result;
}

// Devuelve las fechas (YYYY-MM-DD) en las que dispara una programación.
// Función pura, sin acceso a base de datos — usa `rrule` (RFC5545, el mismo
// estándar que usa Google Calendar por dentro) para la recurrencia.
export function generarFechas({ fechaInicio, esRecurrente, frecuencia, intervalo = 1, fechaFin, numRepeticiones }) {
  if (!esRecurrente) return [fechaInicio];

  const dtstart = toUtcDate(fechaInicio);
  const horizonte = addMeses(dtstart, HORIZON_MESES);

  const options = {
    freq: FREQ_MAP[frecuencia],
    interval: intervalo,
    dtstart,
  };

  // COUNT y UNTIL no se combinan en una misma regla: se prioriza
  // numRepeticiones si viene, si no fechaFin, y si no hay ninguna de las dos
  // ("finalizar nunca") se acota por el horizonte.
  if (numRepeticiones) {
    options.count = Math.min(numRepeticiones, MAX_OCURRENCIAS);
  } else if (fechaFin) {
    const fin = toUtcDate(fechaFin);
    options.until = fin < horizonte ? fin : horizonte;
  } else {
    options.until = horizonte;
  }

  const rule = new RRule(options);
  return rule.all().map(toIsoDate).slice(0, MAX_OCURRENCIAS);
}

// Empareja cada fecha generada con su(s) lote(s) según el modo de la serie.
// UNICO: 1 ocurrencia por fecha, siempre en `loteId`.
// ROTACION: 1 ocurrencia por fecha, rotando round-robin por `lotes` en orden.
// SIMULTANEO: N ocurrencias por fecha (una por cada lote en `lotes`).
export function expandirPorLote(fechas, { modoLotes, loteId, lotes }) {
  if (modoLotes === 'UNICO') {
    return fechas.map((fecha) => ({ fecha, loteId }));
  }

  if (modoLotes === 'ROTACION') {
    return fechas.map((fecha, i) => ({ fecha, loteId: lotes[i % lotes.length] }));
  }

  const resultado = [];
  for (const fecha of fechas) {
    for (const loteIdActual of lotes) {
      resultado.push({ fecha, loteId: loteIdActual });
    }
  }
  return resultado;
}
