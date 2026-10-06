// Orden único de los insumos de una receta en TODA la API: primero el
// insumo principal (esPrincipal) y después el resto en el orden en que se
// agregaron originalmente (campo `orden`, o el id si nunca se reordenó) — pedido explícito: así se ve
// igual en cualquier pantalla, correo, PDF o Excel.
// Además, el ACONDICIONADOR va SIEMPRE inmediatamente después del Agua
// (pedido explícito), sin importar el orden en que se agregaron.
export function ordenarComponentesReceta(componentes, principalArticuloId = null) {
  const esPrincipal = (c) => Boolean(c.esPrincipal) || (principalArticuloId !== null && principalArticuloId !== undefined && c.articuloId === principalArticuloId);
  const lista = [...componentes].sort((a, b) => Number(esPrincipal(b)) - Number(esPrincipal(a)) || (a.orden ?? a.id) - (b.orden ?? b.id));

  const iAgua = lista.findIndex((c) => c.articulo?.nombre === 'Agua');
  const iRegulador = lista.findIndex((c) => c.articulo?.nombre === 'ACONDICIONADOR');
  if (iAgua === -1 || iRegulador === -1 || esPrincipal(lista[iRegulador]) || iRegulador === iAgua + 1) return lista;
  const [regulador] = lista.splice(iRegulador, 1);
  lista.splice(lista.findIndex((c) => c.articulo?.nombre === 'Agua') + 1, 0, regulador);
  return lista;
}

function ordenarEnArbol(valor, visitados = new Set()) {
  if (!valor || typeof valor !== 'object' || visitados.has(valor)) return;
  visitados.add(valor);
  if (Array.isArray(valor)) {
    valor.forEach((v) => ordenarEnArbol(v, visitados));
    return;
  }
  const datos = valor.dataValues;
  if (!datos) return;
  if (Array.isArray(datos.componentes) && datos.componentes.some((c) => c?.dataValues && 'esPrincipal' in c.dataValues)) {
    const ordenados = ordenarComponentesReceta(datos.componentes);
    datos.componentes = ordenados;
    valor.componentes = ordenados;
  }
  Object.values(datos).forEach((v) => {
    if (v && typeof v === 'object') ordenarEnArbol(v, visitados);
  });
}

// Hook afterFind para los modelos raíz que devuelven recetas (directa o
// anidadamente). Si la consulta trae la receta de la mezcla, el snapshot de
// insumos de una aspersión (que no guarda esPrincipal) también sale con el
// principal primero.
export function ordenarRecetasAfterFind(resultado) {
  ordenarEnArbol(resultado);
  const filas = Array.isArray(resultado) ? resultado : resultado ? [resultado] : [];
  for (const fila of filas) {
    const snapshot = fila?.dataValues?.componentes;
    const recetaMezcla = fila?.dataValues?.mezcla?.dataValues?.versiones?.[0]?.dataValues?.componentes;
    const principal = recetaMezcla?.find((c) => c.esPrincipal);
    if (principal && Array.isArray(snapshot) && snapshot.length && !('esPrincipal' in (snapshot[0].dataValues || {}))) {
      const ordenados = ordenarComponentesReceta(snapshot, principal.articuloId);
      fila.dataValues.componentes = ordenados;
      fila.componentes = ordenados;
    }
  }
}
