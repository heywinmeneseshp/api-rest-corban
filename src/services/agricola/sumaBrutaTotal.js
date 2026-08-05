import { sumaBrutaRepository } from '../../repositories/agricola/sumaBruta.repository.js';

const valorPorEstadio = (valores) => new Map(valores.map((v) => [v.estadio, Number(v.valor)]));

// La app móvil envía cadena vacía para "sin estadio"; en la tabla esa opción
// es el estadio "0" (configurable, default 0).
const normalizar = (estadio) => (estadio === '' ? '0' : estadio);

// Suma los valores configurables (tabla `estadios_sigatoka`) de los estadios
// registrados en cada hoja. Se calcula SIEMPRE al leer, consultando la tabla
// en ese momento, para que un cambio de valores en la administración se
// refleje en los reportes sin tocar código ni regenerar datos.
export async function calcularTotal(estadios, { transaction } = {}) {
  if (!estadios?.length) return 0;

  const denominaciones = [...new Set(estadios.map((e) => normalizar(e.estadio)).filter(Boolean))];
  const valores = await sumaBrutaRepository.findEstadiosValuesByNames(denominaciones, { transaction });
  const porEstadio = valorPorEstadio(valores);

  return estadios.reduce((acc, e) => acc + (porEstadio.get(normalizar(e.estadio)) ?? 0), 0);
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
      s.total = s.estadios.reduce((acc, e) => acc + (porEstadio.get(normalizar(e.estadio)) ?? 0), 0);
    }
  }

  for (const s of planos) {
    if (s.total === undefined) s.total = 0;
  }

  return planos;
}

export default { calcularTotal, adjuntarTotales };
