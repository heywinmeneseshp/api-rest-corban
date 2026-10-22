// Embolse por hectárea (e/ha) para estimar el embolse de semanas sin dato real: el comportamiento de años pasados ajustado a la
// realidad del año en curso. Mismo concepto que la Proyección anual (embolse ÷ hectáreas productivas), pero con la forma de la
// semana del año (y la anterior) de años pasados escalada por cuánto rinde HOY la finca frente a esos años.
//
// `puntos`: [{ idx, numero, anio, v }] de las semanas reales con embolse y hectáreas productivas (v = embolse ÷ ha).

const NUM_SEMANAS_ANIO = 53;

export const distanciaSemana = (a, b, mod = NUM_SEMANAS_ANIO) => {
  const d = Math.abs(a - b) % mod;
  return Math.min(d, mod - d);
};

const promedio = (lista) => (lista.length > 0 ? lista.reduce((a, b) => a + b, 0) / lista.length : null);
// Mediana: un año con hectáreas mal registradas (e/ha disparado) no arrastra la forma histórica.
const mediana = (lista) => {
  if (lista.length === 0) return null;
  const orden = [...lista].sort((a, b) => a - b);
  const m = Math.floor(orden.length / 2);
  return orden.length % 2 ? orden[m] : (orden[m - 1] + orden[m]) / 2;
};
const semanaAnterior = (numero) => ((numero - 2 + NUM_SEMANAS_ANIO) % NUM_SEMANAS_ANIO) + 1;

/**
 * @param {object} p
 * @param {Array} p.puntos
 * @param {number} p.anioReferencia  Año en curso: la forma histórica sale solo de años anteriores.
 * @param {number} [p.semanasAjuste] Últimas semanas reales usadas para medir el nivel de este año.
 * @param {number} [p.minSemanas]    Con menos semanas, el ajuste pesa proporcionalmente (el resto se queda en 1).
 */
export function crearEstimadorEmbolsePorHa({ puntos, anioReferencia, semanasAjuste = 8, minSemanas = 3 }) {
  // Valor típico (mediana) de una semana del año en años anteriores a `anioMax`; exacto y, si no hay, con ±1 semana.
  function mediaSemana(numero, anioMax) {
    const previos = puntos.filter((p) => p.anio < anioMax);
    const exactos = previos.filter((p) => p.numero === numero).map((p) => p.v);
    if (exactos.length > 0) return mediana(exactos);
    const cercanos = previos.filter((p) => distanciaSemana(p.numero, numero) <= 1).map((p) => p.v);
    return mediana(cercanos);
  }

  // Forma de la semana: promedio del histórico de esa semana del año y de la semana anterior.
  function base(numero, anioMax) {
    const valores = [mediaSemana(numero, anioMax), mediaSemana(semanaAnterior(numero), anioMax)].filter((v) => v !== null);
    return promedio(valores);
  }

  // Nivel de este año frente a la forma histórica, en las últimas semanas reales (acotado a 0.5–1.5).
  let factor = 1;
  let semanasFactor = 0;
  const recientes = [...puntos].sort((a, b) => a.idx - b.idx).slice(-semanasAjuste);
  let sumaReal = 0;
  let sumaBase = 0;
  for (const p of recientes) {
    const b = base(p.numero, p.anio);
    if (b === null || b <= 0) continue;
    sumaReal += p.v;
    sumaBase += b;
    semanasFactor += 1;
  }
  if (sumaBase > 0) {
    const bruto = sumaReal / sumaBase;
    const peso = Math.min(1, semanasFactor / minSemanas);
    factor = Math.min(1.5, Math.max(0.5, 1 + peso * (bruto - 1)));
  }

  return {
    factor,
    semanasFactor,
    /** Embolse por hectárea estimado para esa semana del año (null si no hay historial). */
    estimar(numero) {
      const b = base(numero, anioReferencia);
      return b === null ? null : b * factor;
    },
  };
}
