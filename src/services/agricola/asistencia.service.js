import { Op } from 'sequelize';
import { sequelize } from '../../database/connection.js';
import { Colaborador, ColaboradorRostro, AsistenciaMarcacion, Finca, User } from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { assertFincaPermitida, getFincaIdsPermitidas } from '../../utils/fincaScope.js';
import { ROLES } from '../../constants/roles.constants.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';

// Asistencia por reconocimiento facial. El servidor NO procesa imágenes: recibe el vector (128 números) que el
// dispositivo calculó con face-api y lo compara con los vectores enrolados (distancia euclidiana). No se guarda ni
// una foto ni el vector de cada marcación, solo la distancia.
export const DESCRIPTOR_LEN = 128;
const MAX_MUESTRAS = 8;
const MARGEN_AMBIGUEDAD = 0.05; // el mejor candidato debe superar al segundo por al menos esto
const MINUTOS_ENTRE_MARCAS = 2;

const umbral = () => {
  const n = Number(process.env.FACE_MATCH_THRESHOLD);
  return Number.isFinite(n) && n > 0 ? n : 0.5;
};

const esAdmin = (user) => (user?.roles || []).includes(ROLES.ADMINISTRADOR);
const tienePermiso = (user, codigo) => esAdmin(user) || (user?.permissions || []).includes(codigo);

export const descriptorValido = (d) =>
  Array.isArray(d) && d.length === DESCRIPTOR_LEN && d.every((x) => typeof x === 'number' && Number.isFinite(x));

export const distancia = (a, b) => {
  let suma = 0;
  for (let i = 0; i < DESCRIPTOR_LEN; i += 1) {
    const diff = a[i] - b[i];
    suma += diff * diff;
  }
  return Math.sqrt(suma);
};

// La BD guarda DATETIME en UTC y mysql2 lo entrega como texto sin zona (dateStrings): se devuelve en ISO con «Z» para que
// el navegador no lo tome como hora local (salía 5 horas adelantado en Colombia).
const isoUtc = (v) => (typeof v === 'string' && !v.includes('T') ? new Date(`${v.replace(' ', 'T')}Z`).toISOString() : new Date(v).toISOString());
const redondear = (n, d = 4) => Math.round(n * 10 ** d) / 10 ** d;
const inicioDiaBogota = (fecha) => new Date(`${fecha}T00:00:00-05:00`);
const finDiaBogota = (fecha) => new Date(`${fecha}T23:59:59.999-05:00`);

// Colaboradores enrolados que pueden aparecer en una finca (los de esa finca y los que no tienen finca asignada),
// con todos sus vectores.
async function cargarCandidatos() {
  const colaboradores = await Colaborador.findAll({
    where: { estado: true }, // la finca del colaborador es solo su predeterminada: puede marcar en cualquier finca
    attributes: ['id', 'uuid', 'nombre', 'apellido', 'documento', 'userId'],
    include: [{ model: ColaboradorRostro, as: 'rostros', attributes: ['descriptor'], required: true }],
  });
  return colaboradores.map((c) => ({
    id: c.id,
    uuid: c.uuid,
    nombre: nombreCompleto(c),
    documento: c.documento,
    userId: c.userId,
    vectores: c.rostros.map((r) => (typeof r.descriptor === 'string' ? JSON.parse(r.descriptor) : r.descriptor)),
  }));
}

// Identificación 1:N: la distancia de cada colaborador es la MÍNIMA entre sus vectores (varias poses). Se acepta al
// mejor si está dentro del umbral y supera claramente al segundo; si no, queda como ambigua o no reconocida.
export function identificar(descriptor, candidatos) {
  const ranking = candidatos
    .map((c) => ({ candidato: c, distancia: Math.min(...c.vectores.map((v) => distancia(descriptor, v))) }))
    .sort((a, b) => a.distancia - b.distancia);
  const mejor = ranking[0];
  const segundo = ranking[1];
  const u = umbral();
  if (!mejor || mejor.distancia > u) return { estado: 'NO_RECONOCIDA', mejor, segundo, umbral: u };
  if (segundo && segundo.distancia - mejor.distancia < MARGEN_AMBIGUEDAD) return { estado: 'AMBIGUA', mejor, segundo, umbral: u };
  return { estado: 'VERIFICADA', mejor, segundo, umbral: u };
}

const nombreCompleto = (c) => `${c.nombre} ${c.apellido || ''}`.trim();

const resumenCandidato = (r) => (r ? { uuid: r.candidato.uuid, nombre: nombreCompleto(r.candidato), distancia: redondear(r.distancia) } : null);

async function findColaboradorOrFail(uuid) {
  const colaborador = await Colaborador.findOne({ where: { uuid } });
  if (!colaborador) throw ApiError.notFound('Colaborador no encontrado');
  return colaborador;
}

async function findFincaOrFail(uuid) {
  const finca = await Finca.findOne({ where: { uuid }, attributes: ['id', 'uuid', 'nombre'] });
  if (!finca) throw ApiError.badRequest('Finca no encontrada');
  return finca;
}

// ─── Jornadas ───
// Una jornada es lo que hizo un colaborador en un día (Bogotá): estancias en cada finca (ENTRADA → SALIDA en la misma finca) y
// el tránsito entre la salida de una y la entrada de la siguiente.
const MAX_TURNO_MS = 16 * 3600 * 1000; // una SALIDA cierra la ENTRADA abierta si está a 16 h o menos (turnos que cruzan medianoche)
const DIAS_MAX_JORNADAS = 62;
const MS_DIA = 86400000;
const diaBogota = (ms) => new Date(ms - 5 * 3600 * 1000).toISOString().slice(0, 10);
const minutosEntre = (a, b) => Math.round((b - a) / 60000);

// `marcaciones`: [{ colaborador: { id, ... }, finca: { id, uuid, nombre }, tipo, ms }] (cualquier orden).
// Devuelve las jornadas sin filtrar, con tiempos en ms (los convierte a ISO quien responde).
export function armarJornadas(marcaciones, hoy = diaBogota(Date.now())) {
  const porColaborador = new Map();
  for (const m of [...marcaciones].sort((a, b) => a.ms - b.ms)) {
    if (!porColaborador.has(m.colaborador.id)) porColaborador.set(m.colaborador.id, []);
    porColaborador.get(m.colaborador.id).push(m);
  }

  const jornadas = [];
  for (const marcas of porColaborador.values()) {
    const colaborador = marcas[0].colaborador;
    const porDia = new Map();
    const agregar = (estancia) => {
      const fecha = diaBogota(estancia.entrada ?? estancia.salida);
      if (!porDia.has(fecha)) porDia.set(fecha, []);
      porDia.get(fecha).push(estancia);
    };
    let abierta = null;
    const cerrarSinSalida = () => {
      if (abierta) agregar({ finca: abierta.finca, entrada: abierta.ms, salida: null, estado: 'SIN_SALIDA' });
      abierta = null;
    };

    for (const m of marcas) {
      const mismaAbierta = abierta && abierta.finca.id === m.finca.id && m.ms - abierta.ms <= MAX_TURNO_MS;
      if (m.tipo === 'ENTRADA') {
        if (mismaAbierta) continue; // entrada repetida: cuenta la primera
        cerrarSinSalida();
        abierta = { finca: m.finca, ms: m.ms };
      } else if (mismaAbierta) {
        agregar({ finca: m.finca, entrada: abierta.ms, salida: m.ms, estado: 'COMPLETA' });
        abierta = null;
      } else {
        cerrarSinSalida();
        agregar({ finca: m.finca, entrada: null, salida: m.ms, estado: 'SIN_ENTRADA' });
      }
    }
    cerrarSinSalida();

    for (const [fecha, estancias] of porDia) {
      estancias.sort((a, b) => (a.entrada ?? a.salida) - (b.entrada ?? b.salida));
      const tramos = [];
      estancias.forEach((e, i) => {
        const anterior = estancias[i - 1];
        if (anterior && anterior.salida !== null && e.entrada !== null && e.entrada >= anterior.salida) {
          tramos.push({
            tipo: 'TRANSITO',
            desde: anterior.finca,
            hasta: e.finca,
            salida: anterior.salida,
            entrada: e.entrada,
            minutos: minutosEntre(anterior.salida, e.entrada),
            mismaFinca: anterior.finca.id === e.finca.id,
          });
        }
        const enCurso = e.estado === 'SIN_SALIDA' && fecha === hoy && i === estancias.length - 1;
        tramos.push({
          tipo: 'ESTANCIA',
          ...e,
          estado: enCurso ? 'EN_CURSO' : e.estado,
          minutos: e.estado === 'COMPLETA' ? minutosEntre(e.entrada, e.salida) : null,
        });
      });
      const est = tramos.filter((t) => t.tipo === 'ESTANCIA');
      const tra = tramos.filter((t) => t.tipo === 'TRANSITO');
      const entradas = est.map((t) => t.entrada).filter((x) => x !== null);
      const salidas = est.map((t) => t.salida).filter((x) => x !== null);
      jornadas.push({
        fecha,
        colaborador,
        primeraEntrada: entradas.length ? Math.min(...entradas) : null,
        ultimaSalida: salidas.length ? Math.max(...salidas) : null,
        minutosEnFincas: est.reduce((s, t) => s + (t.minutos || 0), 0),
        minutosTransito: tra.filter((t) => !t.mismaFinca).reduce((s, t) => s + t.minutos, 0),
        minutosFuera: tra.filter((t) => t.mismaFinca).reduce((s, t) => s + t.minutos, 0),
        lugares: new Set(est.map((t) => t.finca.id)).size,
        incompleta: est.some((t) => t.estado === 'SIN_SALIDA' || t.estado === 'SIN_ENTRADA'),
        enCurso: est.some((t) => t.estado === 'EN_CURSO'),
        tramos,
      });
    }
  }
  return jornadas;
}

export const asistenciaService = {
  // ─── Enrolamiento ───
  // `muestras`: [{ pose, descriptor }] — una por ángulo. Con `reforzar` se agregan a las existentes (tope MAX_MUESTRAS);
  // si no, reemplazan todo. Los vectores anteriores se borran de verdad (no soft delete): es un dato biométrico.
  async enrolarRostro(colaboradorUuid, { muestras, consentimiento, reforzar = false }, actorId, user) {
    const colaborador = await findColaboradorOrFail(colaboradorUuid);
    if (colaborador.fincaId) assertFincaPermitida(user, colaborador.fincaId);
    if (!consentimiento && !colaborador.rostroConsentimientoAt) {
      throw ApiError.badRequest('Se requiere la autorización del colaborador para registrar su rostro');
    }
    for (const m of muestras) {
      if (!descriptorValido(m.descriptor)) throw ApiError.badRequest(`La muestra "${m.pose || ''}" no es un vector facial válido (128 números)`);
    }

    return sequelize.transaction(async (transaction) => {
      if (!reforzar) await ColaboradorRostro.destroy({ where: { colaboradorId: colaborador.id }, force: true, transaction });
      const existentes = reforzar ? await ColaboradorRostro.count({ where: { colaboradorId: colaborador.id }, transaction }) : 0;
      if (existentes + muestras.length > MAX_MUESTRAS) {
        throw ApiError.badRequest(`Máximo ${MAX_MUESTRAS} muestras por colaborador (ya tiene ${existentes})`);
      }
      await ColaboradorRostro.bulkCreate(
        muestras.map((m) => ({ colaboradorId: colaborador.id, pose: m.pose || null, descriptor: m.descriptor, createdBy: actorId })),
        { transaction },
      );
      if (!colaborador.rostroConsentimientoAt) await colaborador.update({ rostroConsentimientoAt: new Date() }, { transaction });
      return { colaboradorUuid, muestras: existentes + muestras.length };
    });
  },

  async borrarRostro(colaboradorUuid, user) {
    const colaborador = await findColaboradorOrFail(colaboradorUuid);
    if (colaborador.fincaId) assertFincaPermitida(user, colaborador.fincaId);
    await sequelize.transaction(async (transaction) => {
      await ColaboradorRostro.destroy({ where: { colaboradorId: colaborador.id }, force: true, transaction });
      await colaborador.update({ rostroConsentimientoAt: null }, { transaction });
    });
  },

  // Colaboradores y cuántas muestras faciales tiene cada uno (para las pantallas de enrolamiento).
  async rostrosEstado(query, user) {
    const fincaIds = getFincaIdsPermitidas(user);
    const where = { estado: true };
    if (query.fincaUuid) assertFincaPermitida(user, (await findFincaOrFail(query.fincaUuid)).id);
    const colaboradores = await Colaborador.findAll({
      where,
      attributes: ['id', 'uuid', 'nombre', 'apellido', 'documento', 'fincaId', 'userId', 'rostroConsentimientoAt'],
      include: [
        { model: Finca, as: 'finca', attributes: ['uuid', 'nombre'] },
        { model: User, as: 'usuario', attributes: ['uuid'] },
      ],
      order: [['nombre', 'ASC']],
    });
    const conteos = await ColaboradorRostro.findAll({
      attributes: ['colaboradorId', [sequelize.fn('COUNT', sequelize.col('id')), 'n']],
      where: { colaboradorId: { [Op.in]: colaboradores.map((c) => c.id) } },
      group: ['colaboradorId'],
      raw: true,
    });
    const porId = new Map(conteos.map((c) => [c.colaboradorId, Number(c.n)]));
    const fincas = await Finca.findAll({
      where: query.fincaUuid ? { uuid: query.fincaUuid } : fincaIds ? { id: { [Op.in]: fincaIds } } : {},
      attributes: ['uuid', 'nombre'],
      order: [['nombre', 'ASC']],
    });
    return {
      fincas: fincas.map((f) => ({ uuid: f.uuid, nombre: f.nombre })),
      colaboradores: colaboradores.map((c) => ({
        uuid: c.uuid,
        nombre: nombreCompleto(c),
        documento: c.documento,
        userUuid: c.usuario?.uuid ?? null,
        finca: c.finca ? { uuid: c.finca.uuid, nombre: c.finca.nombre } : null,
        muestras: porId.get(c.id) || 0,
        enrolado: (porId.get(c.id) || 0) > 0,
        consentimiento: Boolean(c.rostroConsentimientoAt),
      })),
    };
  },

  // Prueba de reconocimiento (piloto): identifica sin guardar nada y devuelve los dos mejores candidatos con su distancia.
  async probar({ fincaUuid, descriptor }, user) {
    // La finca es opcional: el reconocimiento compara contra todos los colaboradores con rostro registrado.
    if (fincaUuid) assertFincaPermitida(user, (await findFincaOrFail(fincaUuid)).id);
    if (!descriptorValido(descriptor)) throw ApiError.badRequest('El vector facial no es válido (128 números)');
    const candidatos = await cargarCandidatos();
    if (candidatos.length === 0) return { estado: 'SIN_ENROLADOS', umbral: umbral(), mejor: null, segundo: null };
    const r = identificar(descriptor, candidatos);
    return { estado: r.estado, umbral: r.umbral, margen: MARGEN_AMBIGUEDAD, mejor: resumenCandidato(r.mejor), segundo: resumenCandidato(r.segundo) };
  },

  // ─── Marcaciones ───
  // Lote desde la app (cola offline). Idempotente por `uuid`. Devuelve el resultado de cada elemento.
  async registrarMarcaciones(items, actorId, user) {
    const puedeCuadrilla = tienePermiso(user, PERMISSIONS.ASISTENCIA_MARCAR_CUADRILLA);
    const puedePropia = tienePermiso(user, PERMISSIONS.ASISTENCIA_MARCAR);
    if (!puedeCuadrilla && !puedePropia) throw ApiError.forbidden('No tienes permiso para marcar asistencia');

    const fincas = await Finca.findAll({ where: { uuid: { [Op.in]: [...new Set(items.map((i) => i.fincaUuid))] } }, attributes: ['id', 'uuid'] });
    const fincaPorUuid = new Map(fincas.map((f) => [f.uuid, f]));
    // Cualquier colaborador con rostro registrado puede marcar en cualquier finca: se cargan una sola vez.
    const candidatos = await cargarCandidatos();
    const ya = await AsistenciaMarcacion.findAll({ where: { uuid: { [Op.in]: items.map((i) => i.uuid) } }, attributes: ['uuid'], paranoid: false, raw: true });
    const yaRegistradas = new Set(ya.map((m) => m.uuid));

    const resultados = [];
    for (const item of items) {
      const res = (estado, extra = {}) => resultados.push({ uuid: item.uuid, estado, ...extra });
      if (yaRegistradas.has(item.uuid)) {
        res('DUPLICADA');
        continue;
      }
      const finca = fincaPorUuid.get(item.fincaUuid);
      if (!finca) {
        res('ERROR', { mensaje: 'Finca no encontrada' });
        continue;
      }
      try {
        assertFincaPermitida(user, finca.id);
      } catch {
        res('ERROR', { mensaje: 'No tienes acceso a esa finca' });
        continue;
      }
      if (!descriptorValido(item.descriptor)) {
        res('ERROR', { mensaje: 'Vector facial inválido' });
        continue;
      }
      if (candidatos.length === 0) {
        res('ERROR', { mensaje: 'No hay colaboradores con rostro registrado' });
        continue;
      }

      const r = identificar(item.descriptor, candidatos);
      if (r.estado !== 'VERIFICADA') {
        res(r.estado, { mejor: resumenCandidato(r.mejor), segundo: resumenCandidato(r.segundo) });
        continue;
      }
      const colaborador = r.mejor.candidato;
      // Sin permiso de cuadrilla solo puede marcarse a sí mismo (el colaborador vinculado a su usuario).
      if (!puedeCuadrilla && colaborador.userId !== user.id) {
        res('ERROR', { mensaje: 'Solo puedes marcar tu propia asistencia' });
        continue;
      }

      const fechaHora = new Date(item.fechaHora);
      const ventana = MINUTOS_ENTRE_MARCAS * 60 * 1000;
      const cercana = await AsistenciaMarcacion.findOne({
        where: {
          colaboradorId: colaborador.id,
          tipo: item.tipo,
          fechaHora: { [Op.between]: [new Date(fechaHora.getTime() - ventana), new Date(fechaHora.getTime() + ventana)] },
        },
        attributes: ['id'],
      });
      if (cercana) {
        res('DUPLICADA', { colaborador: { uuid: colaborador.uuid, nombre: nombreCompleto(colaborador) }, mensaje: 'Ya hay una marcación igual hace menos de 2 minutos' });
        continue;
      }

      await AsistenciaMarcacion.create({
        uuid: item.uuid,
        colaboradorId: colaborador.id,
        fincaId: finca.id,
        tipo: item.tipo,
        fechaHora,
        lat: item.lat ?? null,
        lng: item.lng ?? null,
        distancia: redondear(r.mejor.distancia),
        createdBy: actorId,
      });
      yaRegistradas.add(item.uuid);
      res('CREADA', { colaborador: { uuid: colaborador.uuid, nombre: nombreCompleto(colaborador) }, distancia: redondear(r.mejor.distancia) });
    }

    const cuenta = (e) => resultados.filter((x) => x.estado === e).length;
    return {
      total: items.length,
      creadas: cuenta('CREADA'),
      duplicadas: cuenta('DUPLICADA'),
      noReconocidas: cuenta('NO_RECONOCIDA'),
      ambiguas: cuenta('AMBIGUA'),
      errores: cuenta('ERROR'),
      resultados,
    };
  },

  async listar(query, user) {
    const { page, limit, offset } = getPagination(query);
    const where = {};
    const fincaIds = getFincaIdsPermitidas(user);
    if (query.fincaUuid) {
      const finca = await findFincaOrFail(query.fincaUuid);
      assertFincaPermitida(user, finca.id);
      where.fincaId = finca.id;
    } else if (fincaIds) {
      where.fincaId = { [Op.in]: fincaIds };
    }
    if (query.colaboradorUuid) {
      const c = await findColaboradorOrFail(query.colaboradorUuid);
      where.colaboradorId = c.id;
    }
    if (query.desde || query.hasta) {
      where.fechaHora = {
        ...(query.desde ? { [Op.gte]: inicioDiaBogota(query.desde) } : {}),
        ...(query.hasta ? { [Op.lte]: finDiaBogota(query.hasta) } : {}),
      };
    }
    if (query.tipo) where.tipo = query.tipo;

    const { rows, count } = await AsistenciaMarcacion.findAndCountAll({
      where,
      limit,
      offset,
      order: [['fechaHora', 'DESC']],
      include: [
        { model: Colaborador, as: 'colaborador', attributes: ['uuid', 'nombre', 'apellido', 'documento', 'cargo'] },
        { model: Finca, as: 'finca', attributes: ['uuid', 'nombre'] },
      ],
    });
    const autores = await User.findAll({
      where: { id: { [Op.in]: [...new Set(rows.map((r) => r.createdBy).filter(Boolean))] } },
      attributes: ['id', 'nombre', 'apellido'],
      raw: true,
    });
    const nombreAutor = new Map(autores.map((u) => [u.id, `${u.nombre} ${u.apellido || ''}`.trim()]));

    const items = rows.map((m) => ({
      uuid: m.uuid,
      colaborador: m.colaborador ? { uuid: m.colaborador.uuid, nombre: nombreCompleto(m.colaborador), documento: m.colaborador.documento, cargo: m.colaborador.cargo || null } : null,
      finca: m.finca ? { uuid: m.finca.uuid, nombre: m.finca.nombre } : null,
      tipo: m.tipo,
      fechaHora: isoUtc(m.fechaHora),
      lat: m.lat === null ? null : Number(m.lat),
      lng: m.lng === null ? null : Number(m.lng),
      distancia: m.distancia === null ? null : Number(m.distancia),
      marcadoPor: nombreAutor.get(m.createdBy) || '',
    }));
    return { items, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async jornadas(query, user) {
    const { page, limit, offset } = getPagination(query);
    const hoy = diaBogota(Date.now());
    const hasta = query.hasta || hoy;
    const desde = query.desde || diaBogota(new Date(`${hasta}T12:00:00Z`).getTime() - 6 * MS_DIA);
    if (desde > hasta) throw ApiError.badRequest('La fecha Desde no puede ser mayor que Hasta');
    if ((new Date(hasta) - new Date(desde)) / MS_DIA + 1 > DIAS_MAX_JORNADAS) {
      throw ApiError.badRequest(`El rango de fechas no puede pasar de ${DIAS_MAX_JORNADAS} días`);
    }

    let fincaFiltro = null;
    if (query.fincaUuid) {
      fincaFiltro = await findFincaOrFail(query.fincaUuid);
      assertFincaPermitida(user, fincaFiltro.id);
    }
    // Se traen TODAS las fincas permitidas (no solo la filtrada) para no perder el tránsito hacia/desde otras fincas, y 16 h antes y
    // después del rango para emparejar turnos que cruzan medianoche.
    const where = {
      fechaHora: { [Op.between]: [new Date(inicioDiaBogota(desde).getTime() - MAX_TURNO_MS), new Date(finDiaBogota(hasta).getTime() + MAX_TURNO_MS)] },
    };
    const fincaIds = getFincaIdsPermitidas(user);
    if (fincaIds) where.fincaId = { [Op.in]: fincaIds };
    if (query.colaboradorUuid) where.colaboradorId = (await findColaboradorOrFail(query.colaboradorUuid)).id;

    const rows = await AsistenciaMarcacion.findAll({
      where,
      attributes: ['tipo', 'fechaHora'],
      include: [
        { model: Colaborador, as: 'colaborador', attributes: ['id', 'uuid', 'nombre', 'apellido', 'documento', 'cargo'] },
        { model: Finca, as: 'finca', attributes: ['id', 'uuid', 'nombre'] },
      ],
    });
    const marcaciones = rows
      .filter((r) => r.colaborador && r.finca)
      .map((r) => ({
        tipo: r.tipo,
        ms: new Date(isoUtc(r.fechaHora)).getTime(),
        finca: { id: r.finca.id, uuid: r.finca.uuid, nombre: r.finca.nombre },
        colaborador: {
          id: r.colaborador.id,
          uuid: r.colaborador.uuid,
          nombre: nombreCompleto(r.colaborador),
          documento: r.colaborador.documento,
          cargo: r.colaborador.cargo || null,
        },
      }));

    const todas = armarJornadas(marcaciones, hoy)
      .filter((j) => j.fecha >= desde && j.fecha <= hasta)
      .filter((j) => !fincaFiltro || j.tramos.some((t) => t.tipo === 'ESTANCIA' && t.finca.id === fincaFiltro.id))
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || a.colaborador.nombre.localeCompare(b.colaborador.nombre, 'es'));

    const iso = (ms) => (ms === null ? null : new Date(ms).toISOString());
    const finca = (f) => ({ uuid: f.uuid, nombre: f.nombre });
    const items = todas.slice(offset, offset + limit).map(({ colaborador: { id: _id, ...colaborador }, ...j }) => ({
      ...j,
      colaborador,
      primeraEntrada: iso(j.primeraEntrada),
      ultimaSalida: iso(j.ultimaSalida),
      tramos: j.tramos.map((t) =>
        t.tipo === 'TRANSITO'
          ? { ...t, desde: finca(t.desde), hasta: finca(t.hasta), salida: iso(t.salida), entrada: iso(t.entrada) }
          : { ...t, finca: finca(t.finca), entrada: iso(t.entrada), salida: iso(t.salida) },
      ),
    }));
    return { desde, hasta, items, meta: buildPaginationMeta({ page, limit, total: todas.length }) };
  },

  async eliminar(uuid, actorId) {
    const marcacion = await AsistenciaMarcacion.findOne({ where: { uuid } });
    if (!marcacion) throw ApiError.notFound('Marcación no encontrada');
    await marcacion.update({ deletedBy: actorId });
    await marcacion.destroy();
  },
};

export default asistenciaService;
