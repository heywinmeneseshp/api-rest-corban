import { Op } from 'sequelize';
import { EvaluacionRecorrido, EvaluacionRecorridoPunto, Finca, User } from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';
import { assertFincaPermitida, getFincaIdsPermitidas } from '../../utils/fincaScope.js';

// Recorrido (traza GPS) del evaluador: la app móvil crea un recorrido por finca, sube sus puntos (cada ~15 s o 15 m) y lo cierra. La web lo
// dibuja por evaluador y día. Los puntos son idempotentes (único recorrido + momento) para poder reenviar la cola offline.
const MAX_PUNTOS_POR_RECORRIDO = 20000;
const MAX_VELOCIDAD_MS = 3; // más rápido que eso no es caminando: salto de GPS
const MIN_VELOCIDAD_MOVIMIENTO_MS = 0.3;

const distanciaM = (a, b) => {
  const rad = (g) => (g * Math.PI) / 180;
  const x = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(x));
};

// Distancia recorrida y tiempo en movimiento sobre puntos [{ lat, lng, t en ms }] ordenados.
function recorridoDePuntos(puntos) {
  let distM = 0;
  let movSeg = 0;
  let previo = puntos[0];
  for (let i = 1; i < puntos.length; i += 1) {
    const actual = puntos[i];
    const dt = (actual.t - previo.t) / 1000;
    if (dt <= 0) continue;
    const d = distanciaM(previo, actual);
    const v = d / dt;
    if (v > MAX_VELOCIDAD_MS) continue;
    distM += d;
    if (v > MIN_VELOCIDAD_MOVIMIENTO_MS && dt <= 60) movSeg += dt;
    previo = actual;
  }
  return { distM, movSeg };
}

const comoMs = (v) => new Date(v).getTime();
const redondear = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const nombreUsuario = (u) => `${u?.nombre || ''} ${u?.apellido || ''}`.trim() || u?.usuario || '';

async function findRecorridoOrFail(uuid, user, { soloPropio = false } = {}) {
  const r = await EvaluacionRecorrido.findOne({ where: { uuid } });
  if (!r) throw ApiError.notFound('Recorrido no encontrado');
  assertFincaPermitida(user, r.fincaId);
  if (soloPropio && r.usuarioId !== user?.id) throw ApiError.forbidden('Solo puedes modificar tus propios recorridos');
  return r;
}

export const evaluacionRecorridoService = {
  // Crea el recorrido (idempotente por uuid: reenviarlo no duplica). El evaluador es siempre el usuario de la sesión.
  async iniciar(body, user) {
    const finca = await Finca.findOne({ where: { uuid: body.fincaUuid }, attributes: ['id', 'uuid', 'nombre'] });
    if (!finca) throw ApiError.badRequest('Finca no encontrada');
    assertFincaPermitida(user, finca.id);
    const existente = await EvaluacionRecorrido.findOne({ where: { uuid: body.uuid } });
    if (existente) {
      if (existente.usuarioId !== user.id) throw ApiError.forbidden('Este recorrido pertenece a otro usuario');
      return { uuid: existente.uuid };
    }
    const r = await EvaluacionRecorrido.create({ uuid: body.uuid, usuarioId: user.id, fincaId: finca.id, inicio: new Date(body.inicio) });
    return { uuid: r.uuid };
  },

  async cerrar(uuid, body, user) {
    const r = await findRecorridoOrFail(uuid, user, { soloPropio: true });
    if (!r.fin) await r.update({ fin: new Date(body.fin) });
    return { uuid: r.uuid };
  },

  // Recibe puntos en lotes; un punto repetido (mismo momento) se ignora.
  async subirPuntos(uuid, puntos, user) {
    const r = await findRecorridoOrFail(uuid, user, { soloPropio: true });
    const actuales = await EvaluacionRecorridoPunto.count({ where: { recorridoId: r.id } });
    if (actuales >= MAX_PUNTOS_POR_RECORRIDO) throw ApiError.badRequest('El recorrido llegó al máximo de puntos permitido');
    const filas = puntos.map((p) => ({ recorridoId: r.id, lat: p.lat, lng: p.lng, precisionM: p.precision ?? null, registradoAt: new Date(p.t) }));
    await EvaluacionRecorridoPunto.bulkCreate(filas, { ignoreDuplicates: true });
    return { recibidos: filas.length };
  },

  // Recorridos por evaluador, finca y día (hora de Bogotá), con distancia y tiempo en movimiento. Solo de las fincas permitidas.
  async listar(query, user) {
    const fincaIds = getFincaIdsPermitidas(user);
    const where = {};
    if (fincaIds) where.fincaId = { [Op.in]: fincaIds };
    if (query.fincaUuid) {
      const finca = await Finca.findOne({ where: { uuid: query.fincaUuid }, attributes: ['id'] });
      if (!finca) throw ApiError.badRequest('Finca no encontrada');
      assertFincaPermitida(user, finca.id);
      where.fincaId = finca.id;
    }
    if (query.usuarioUuid) {
      const u = await User.findOne({ where: { uuid: query.usuarioUuid }, attributes: ['id'] });
      where.usuarioId = u?.id ?? -1;
    }
    if (query.fecha) {
      const desde = new Date(`${query.fecha}T00:00:00-05:00`);
      where.inicio = { [Op.gte]: desde, [Op.lt]: new Date(desde.getTime() + 86400000) };
    }
    const filas = await EvaluacionRecorrido.findAll({
      where,
      include: [
        { model: Finca, as: 'finca', attributes: ['uuid', 'codigo', 'nombre'] },
        { model: User, as: 'usuario', attributes: ['uuid', 'usuario', 'nombre', 'apellido'] },
      ],
      order: [['inicio', 'DESC']],
      limit: 200,
    });
    const items = [];
    for (const r of filas) {
      const puntos = await EvaluacionRecorridoPunto.findAll({ where: { recorridoId: r.id }, attributes: ['lat', 'lng', 'registradoAt'], order: [['registradoAt', 'ASC']], raw: true });
      const medidas = puntos.length ? recorridoDePuntos(puntos.map((p) => ({ lat: Number(p.lat), lng: Number(p.lng), t: comoMs(p.registradoAt) }))) : { distM: 0, movSeg: 0 };
      items.push({
        uuid: r.uuid,
        finca: r.finca,
        evaluador: r.usuario ? { uuid: r.usuario.uuid, nombre: nombreUsuario(r.usuario) } : null,
        inicio: r.inicio,
        fin: r.fin,
        puntos: puntos.length,
        distanciaM: redondear(medidas.distM, 0),
        movimientoMin: redondear(medidas.movSeg / 60, 1),
      });
    }
    return { items };
  },

  // Puntos de un recorrido para dibujarlo en el mapa.
  async puntos(uuid, user) {
    const r = await findRecorridoOrFail(uuid, user);
    const puntos = await EvaluacionRecorridoPunto.findAll({ where: { recorridoId: r.id }, attributes: ['lat', 'lng', 'precisionM', 'registradoAt'], order: [['registradoAt', 'ASC']], raw: true });
    return { puntos: puntos.map((p) => ({ lat: Number(p.lat), lng: Number(p.lng), t: new Date(p.registradoAt).toISOString() })) };
  },
};

export default evaluacionRecorridoService;
