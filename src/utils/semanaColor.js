// Cinta de color que se usa físicamente al embolsar cada racimo en la
// semana correspondiente. Ciclo de 8 colores; el punto de partida depende
// de si el año es par o impar. La semana 53 (solo existe en años de 53
// semanas) siempre es gris, sin importar el ciclo.
export const COLORES_SEMANA = ['Azul', 'Blanco', 'Amarillo', 'Morado', 'Rojo', 'Café', 'Negro', 'Verde'];

export function calcularColorSemana(anio, numeroSemana) {
  if (numeroSemana === 53) return 'Gris';

  const esAnioImpar = anio % 2 !== 0;
  const indiceInicio = esAnioImpar ? COLORES_SEMANA.indexOf('Rojo') : COLORES_SEMANA.indexOf('Azul');
  const indice = (indiceInicio + (numeroSemana - 1)) % COLORES_SEMANA.length;
  return COLORES_SEMANA[indice];
}

export default calcularColorSemana;
