const ESCALA_MAXIMA_SEVERIDAD = 6;

// Ind_Infec = (suma de grados de las hojas evaluadas / (n° hojas evaluadas *
// 6)) * 100. Se calcula SIEMPRE al leer, a partir de `hojas` (HojaInfectada,
// una fila por hoja con su `severidad`), nunca se persiste. Solo cuentan las
// hojas con severidad registrada — `null`/`undefined` es "no evaluada", no
// resta ni suma al total de hojas evaluadas. Sin ninguna hoja evaluada no
// hay índice que calcular (división por cero): se devuelve `null`.
export function calcularIndiceInfeccion(hojas) {
  const evaluadas = (hojas || []).filter((h) => h?.severidad !== null && h?.severidad !== undefined);
  if (evaluadas.length === 0) return null;

  const sumaGrados = evaluadas.reduce((acc, h) => acc + Number(h.severidad), 0);
  const indice = (sumaGrados / (evaluadas.length * ESCALA_MAXIMA_SEVERIDAD)) * 100;
  return Number(indice.toFixed(2));
}

export default { calcularIndiceInfeccion };
