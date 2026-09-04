// Edad de la planta en semanas, contadas desde su semana de embolse: la
// semana en que se embolsa YA es edad 1 (no 0), la siguiente es edad 2, y
// así sucesivamente — por eso se suma 1 a la diferencia de semanas entre
// las dos fechas de inicio (mismo sistema ISO). Devuelve null si alguna
// fecha es inválida.
export function semanasEntre(fechaInicioA, fechaInicioB) {
  const a = Date.parse(fechaInicioA);
  const b = Date.parse(fechaInicioB);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / (7 * 24 * 60 * 60 * 1000)) + 1;
}

export default semanasEntre;
