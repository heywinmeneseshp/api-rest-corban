// El precio de venta se ingresa a mano (mezclas y productos) sin ninguna
// relación matemática con el costo calculado — el sistema no impide vender
// por debajo del costo. Esto no bloquea el guardado (es una decisión
// comercial del usuario), pero SÍ avisa con una advertencia legible cuando
// pasa, para que no sea un error silencioso.
//
// Si `precioVenta` es 0 (o no se definió todavía), no se advierte nada — 0
// se interpreta como "precio aún no fijado", no como "se vende gratis".
export function evaluarMargen(precioVenta, costoUnitario) {
  const precio = Number(precioVenta || 0);
  const costo = Number(costoUnitario || 0);
  if (precio <= 0 || costo <= 0 || precio >= costo) return [];
  return [
    `El precio de venta (${precio.toFixed(2)}) es menor al costo unitario (${costo.toFixed(2)}) — se estaría vendiendo con pérdida.`,
  ];
}

export default { evaluarMargen };
