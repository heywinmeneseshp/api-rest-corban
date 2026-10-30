// Cuando el área bruta de un lote se actualiza desde un flujo que no pide el área de fumigación (Área de Lotes, carga masiva,
// solicitudes de área), la fumigación no puede quedar mayor que la nueva bruta: se recorta a ella. Devuelve los campos extra.
export function ajusteFumigacion(lote, nuevaBruta) {
  if (lote.areaFumigacion === null || lote.areaFumigacion === undefined) return {};
  if (nuevaBruta === null || nuevaBruta === undefined) return {};
  return Number(lote.areaFumigacion) > Number(nuevaBruta) + 0.005 ? { areaFumigacion: nuevaBruta } : {};
}

// Regla: el área bruta siempre es MAYOR que el área en producción (ni inferior ni igual). Un lote sin producción (0) no la exige.
export function brutaNoSuperaProduccion(bruta, produccion) {
  if (bruta === null || bruta === undefined || produccion === null || produccion === undefined) return false;
  return Number(produccion) > 0 && Number(produccion) >= Number(bruta) - 0.005;
}

export function mensajeBrutaProduccion(bruta, produccion) {
  return `El área bruta (${Number(bruta)} ha) debe ser mayor que el área en producción (${Number(produccion)} ha): no puede ser inferior ni igual`;
}
