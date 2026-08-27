import { sumaBrutaRepository } from '../../repositories/agricola/sumaBruta.repository.js';

const valorPorEstadio = (valores) => new Map(valores.map((v) => [v.estadio, v]));

// La app móvil envía cadena vacía para "sin estadio"; en la tabla esa opción
// es el estadio "0" (configurable, default 0).
const normalizar = (estadio) => (estadio === '' ? '0' : estadio);

// El mismo código de estadio pesa distinto según de cuál de las tres hojas
// evaluadas (3, 4 o 5) venga — `estadios_sigatoka` guarda un valor por hoja
// en vez de uno solo.
const CAMPO_VALOR_POR_HOJA = { 3: 'valorL3', 4: 'valorL4', 5: 'valorL5' };

function valorDeHoja(estadioRow, numeroHoja) {
  if (!estadioRow) return 0;
  const campo = CAMPO_VALOR_POR_HOJA[numeroHoja];
  return campo ? Number(estadioRow[campo] ?? 0) : 0;
}

// Igual que `adjuntarTotales`, pero en vez de sumar todo en un único
// `total`, deja cada estadio con su `valor` ya resuelto por hoja (3, 4 o 5)
// — para desglosar el promedio de Suma Bruta por hoja en vez de solo el
// total. Una sola consulta a `estadios_sigatoka` para todo el lote.
export async function adjuntarValoresPorHoja(sumasBruta, { transaction } = {}) {
  if (!sumasBruta?.length) return sumasBruta;

  const planos = sumasBruta.map((s) => (s?.toJSON ? s.toJSON() : s));
  const conEstadios = planos.filter((s) => Array.isArray(s.estadios) && s.estadios.length > 0);

  if (conEstadios.length > 0) {
    const denominaciones = [
      ...new Set(conEstadios.flatMap((s) => s.estadios.map((e) => normalizar(e.estadio))).filter(Boolean)),
    ];
    const valores = await sumaBrutaRepository.findEstadiosValuesByNames(denominaciones, { transaction });
    const porEstadio = valorPorEstadio(valores);

    for (const s of conEstadios) {
      s.estadios = s.estadios.map((e) => ({ ...e, valor: valorDeHoja(porEstadio.get(normalizar(e.estadio)), e.numeroHoja) }));
    }
  }

  return planos;
}

// Suma los valores configurables (tabla `estadios_sigatoka`) de los estadios
// registrados en cada hoja. Se calcula SIEMPRE al leer, consultando la tabla
// en ese momento, para que un cambio de valores en la administración se
// refleje en los reportes sin tocar código ni regenerar datos.
export async function calcularTotal(estadios, { transaction } = {}) {
  if (!estadios?.length) return 0;

  const denominaciones = [...new Set(estadios.map((e) => normalizar(e.estadio)).filter(Boolean))];
  const valores = await sumaBrutaRepository.findEstadiosValuesByNames(denominaciones, { transaction });
  const porEstadio = valorPorEstadio(valores);

  return estadios.reduce((acc, e) => acc + valorDeHoja(porEstadio.get(normalizar(e.estadio)), e.numeroHoja), 0);
}

// Adjunta `total` (calculado en el momento) a un conjunto de registros de
// SumaBruta con su arreglo `estadios`. Usa UNA sola consulta para todos los
// registros (ej. una página del reporte). Devuelve objetos planos.
export async function adjuntarTotales(sumasBruta, { transaction } = {}) {
  if (!sumasBruta?.length) return sumasBruta;

  const planos = sumasBruta.map((s) => (s?.toJSON ? s.toJSON() : s));
  const conEstadios = planos.filter((s) => Array.isArray(s.estadios) && s.estadios.length > 0);

  if (conEstadios.length > 0) {
    const denominaciones = [
      ...new Set(conEstadios.flatMap((s) => s.estadios.map((e) => normalizar(e.estadio))).filter(Boolean)),
    ];
    const valores = await sumaBrutaRepository.findEstadiosValuesByNames(denominaciones, { transaction });
    const porEstadio = valorPorEstadio(valores);

    for (const s of conEstadios) {
      s.total = s.estadios.reduce((acc, e) => acc + valorDeHoja(porEstadio.get(normalizar(e.estadio)), e.numeroHoja), 0);
    }
  }

  for (const s of planos) {
    if (s.total === undefined) s.total = 0;
  }

  return planos;
}

// Indicador SB_H3 / SB_H5: promedio de las plantas evaluadas de una hoja
// puntual (3 o 5), corregido por candela y normalizado a una base
// equivalente de 10 plantas — independiente de cuántas plantas se hayan
// evaluado realmente en el grupo (finca + semana).
//
//   CC_hoja      = candela × 10, SOLO si esa hoja fue evaluada en esa planta
//                  (si la hoja está vacía, tanto su valor como su CC son 0).
//   aporte_hoja  = max(0, valor_hoja − CC_hoja)  — por planta, nunca negativo
//   SB_hoja      = (Σ aporte_hoja / N_plantas) × 10
//
// El máx(0, ...) es POR PLANTA, no al final del promedio: una planta sana
// (sin síntomas en esa hoja) con candela alta no debe "restar" puntos que
// enmascaren enfermedad real detectada en otras plantas del mismo grupo —
// su aporte es 0, nunca negativo. Antes se sumaba valor y CC por separado
// y se restaba una sola vez al final, lo que sí podía dar un SB_hoja
// negativo para el grupo entero aun cuando la severidad real detectada
// fuera positiva (candela alto en plantas sanas dominaba sobre la
// severidad real de las pocas plantas enfermas).
//
// N_plantas es SIEMPRE el total de plantas del grupo analizado (todas las
// que tienen sumaBruta registrada), no solo las que tienen esa hoja
// puntual evaluada — así una planta con la hoja 3 vacía sigue contando
// para el denominador, aportando 0 al numerador.
//
// El ×2 que aparece en versiones antiguas de esta fórmula NO es un
// coeficiente biológico: es un caso particular de 10/N_plantas cuando
// N_plantas = 5 por lote (10/5 = 2). Por eso acá NUNCA se usa una
// constante fija (×2, /5) — N_plantas se cuenta siempre de los registros
// reales, sea cual sea la cantidad de plantas evaluadas.
//
// `sumasBruta` debe venir ya hidratado con `adjuntarValoresPorHoja`
// (cada estadio con su `.valor` resuelto) y con su `.candela` original.
export function calcularIndicadorHoja(sumasBruta, numeroHoja) {
  const nPlantas = sumasBruta?.length || 0;
  if (nPlantas === 0) return null;

  let sumaAportes = 0;
  for (const sb of sumasBruta) {
    const estadio = (sb.estadios || []).find((e) => e.numeroHoja === numeroHoja);
    if (!estadio) continue; // hoja vacía en esta planta: no aporta nada
    const valor = estadio.valor || 0;
    const cc = (Number(sb.candela) || 0) * 10;
    sumaAportes += Math.max(0, valor - cc);
  }

  const normalizacion = 10 / nPlantas;
  return Number((sumaAportes * normalizacion).toFixed(2));
}

export default { calcularTotal, adjuntarTotales, adjuntarValoresPorHoja, calcularIndicadorHoja };
