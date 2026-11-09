// Festivos de Colombia (Ley 51 de 1983, «Ley Emiliani») y días hábiles de lunes a viernes.
const MS_DIA = 86400000;
const iso = (d) => d.toISOString().slice(0, 10);
const utc = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
const masDias = (d, n) => new Date(d.getTime() + n * MS_DIA);
// Al lunes siguiente si no cae en lunes.
const aLunes = (d) => {
  const dia = d.getUTCDay();
  return dia === 1 ? d : masDias(d, (8 - dia) % 7);
};

// Domingo de Pascua (algoritmo de Meeus/Jones/Butcher).
function pascua(y) {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(y, mes, dia);
}

const cache = new Map();
export function festivosColombia(anio) {
  if (cache.has(anio)) return cache.get(anio);
  const p = pascua(anio);
  const fechas = [
    utc(anio, 1, 1),
    utc(anio, 5, 1),
    utc(anio, 7, 20),
    utc(anio, 8, 7),
    utc(anio, 12, 8),
    utc(anio, 12, 25),
    ...[[1, 6], [3, 19], [6, 29], [8, 15], [10, 12], [11, 1], [11, 11]].map(([m, d]) => aLunes(utc(anio, m, d))),
    masDias(p, -3), // Jueves Santo
    masDias(p, -2), // Viernes Santo
    masDias(p, 43), // Ascensión (lunes)
    masDias(p, 64), // Corpus Christi (lunes)
    masDias(p, 71), // Sagrado Corazón (lunes)
  ];
  const set = new Set(fechas.map(iso));
  cache.set(anio, set);
  return set;
}

export const esFestivo = (fecha) => festivosColombia(Number(fecha.slice(0, 4))).has(fecha);

// Días hábiles (lunes a viernes, sin festivos) entre dos fechas AAAA-MM-DD, inclusive.
export function diasHabiles(desde, hasta) {
  let n = 0;
  for (let d = new Date(`${desde}T00:00:00Z`); iso(d) <= hasta; d = masDias(d, 1)) {
    const dia = d.getUTCDay();
    if (dia !== 0 && dia !== 6 && !esFestivo(iso(d))) n += 1;
  }
  return n;
}
