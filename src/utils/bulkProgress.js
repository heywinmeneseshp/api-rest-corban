const progressMap = new Map();

// Por si un cargue nunca llega a completarse ni a fallar explícitamente
// (proceso reiniciado, cliente abandonado, etc.), para que no se acumulen
// tokens húerfanos en memoria para siempre.
const TTL_MS = 30 * 60 * 1000;

function limpiarViejos() {
  const ahora = Date.now();
  for (const [token, entry] of progressMap) {
    if (entry.startTime && ahora - entry.startTime > TTL_MS) progressMap.delete(token);
  }
}

function calcEta(entry) {
  if (!entry || entry.pct <= 0 || entry.pct >= 100 || !entry.startTime) return null;
  const elapsed = Date.now() - entry.startTime;
  const totalEst = (elapsed / entry.pct) * 100;
  const remaining = Math.round((totalEst - elapsed) / 1000);
  return remaining;
}

export const bulkProgress = {
  init(token, totalFilas) {
    limpiarViejos();
    progressMap.set(token, { pct: 0, fase: 'iniciando', filas: 0, total: totalFilas, error: null, startTime: Date.now() });
  },

  update(token, { pct, fase, filas }) {
    const entry = progressMap.get(token);
    if (entry) {
      Object.assign(entry, { pct, fase, filas });
      entry.eta = calcEta(entry);
    }
  },

  get(token) {
    const entry = progressMap.get(token);
    if (!entry) return null;
    return { ...entry, resultado: undefined, errores: undefined, startTime: undefined };
  },

  remove(token) {
    progressMap.delete(token);
  },

  complete(token, movimientosCreados, errores) {
    const entry = progressMap.get(token);
    if (entry) {
      entry.pct = 100;
      entry.fase = 'completado';
      entry.filas = movimientosCreados;
      entry.eta = 0;
      entry.errores = errores;
      entry.resultado = { movimientosCreados, errores };
    }
  },

  fail(token, error) {
    const entry = progressMap.get(token);
    if (entry) {
      entry.pct = 0;
      entry.fase = 'error';
      entry.eta = null;
      entry.error = error;
    }
  },
};

export default bulkProgress;
