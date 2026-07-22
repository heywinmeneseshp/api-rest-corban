// Cache en memoria de una validación de cargue masivo ya hecha (filas listas
// para insertar, por progressToken), para que el paso de "confirmar carga
// con saldos negativos" no tenga que volver a subir y revalidar el archivo
// completo desde cero — sólo reutiliza lo que ya se calculó en la primera
// pasada.
const cacheMap = new Map();

const TTL_MS = 15 * 60 * 1000; // 15 minutos: tiempo de sobra para que el usuario confirme

function limpiarViejos() {
  const ahora = Date.now();
  for (const [token, entry] of cacheMap) {
    if (ahora - entry.guardadoEn > TTL_MS) cacheMap.delete(token);
  }
}

export const bulkValidationCache = {
  set(token, datos) {
    limpiarViejos();
    cacheMap.set(token, { ...datos, guardadoEn: Date.now() });
  },

  get(token) {
    const entry = cacheMap.get(token);
    if (!entry) return null;
    if (Date.now() - entry.guardadoEn > TTL_MS) {
      cacheMap.delete(token);
      return null;
    }
    return entry;
  },

  remove(token) {
    cacheMap.delete(token);
  },
};

export default bulkValidationCache;
