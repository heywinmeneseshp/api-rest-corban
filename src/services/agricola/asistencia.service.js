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

const redondear = (n, d = 4) => Math.round(n * 10 ** d) / 10 ** d;
const inicioDiaBogota = (fecha) => new Date(`${fecha}T00:00:00-05:00`);
const finDiaBogota = (fecha) => new Date(`${fecha}T23:59:59.999-05:00`);

// Colaboradores enrolados que pueden aparecer en una finca (los de esa finca y los que no tienen finca asignada),
// con todos sus vectores.
async function cargarCandidatos(fincaId) {
  const colaboradores = await Colaborador.findAll({
    where: { estado: true, [Op.or]: [{ fincaId }, { fincaId: null }] },
    attributes: ['id', 'uuid', 'nombre', 'documento', 'userId'],
    include: [{ model: ColaboradorRostro, as: 'rostros', attributes: ['descriptor'], required: true }],
  });
  return colaboradores.map((c) => ({
    id: c.id,
    uuid: c.uuid,
    nombre: c.nombre,
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

const resumenCandidato = (r) => (r ? { uuid: r.candidato.uuid, nombre: r.candidato.nombre, distancia: redondear(r.distancia) } : null);

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
    if (query.fincaUuid) {
      const finca = await findFincaOrFail(query.fincaUuid);
      assertFincaPermitida(user, finca.id);
      where[Op.or] = [{ fincaId: finca.id }, { fincaId: null }];
    } else if (fincaIds) {
      where[Op.or] = [{ fincaId: { [Op.in]: fincaIds } }, { fincaId: null }];
    }
    const colaboradores = await Colaborador.findAll({
      where,
      attributes: ['id', 'uuid', 'nombre', 'documento', 'fincaId', 'rostroConsentimientoAt'],
      include: [{ model: Finca, as: 'finca', attributes: ['uuid', 'nombre'] }],
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
        nombre: c.nombre,
        documento: c.documento,
        finca: c.finca ? { uuid: c.finca.uuid, nombre: c.finca.nombre } : null,
        muestras: porId.get(c.id) || 0,
        enrolado: (porId.get(c.id) || 0) > 0,
        consentimiento: Boolean(c.rostroConsentimientoAt),
      })),
    };
  },

  // Prueba de reconocimiento (piloto): identifica sin guardar nada y devuelve los dos mejores candidatos con su distancia.
  async probar({ fincaUuid, descriptor }, user) {
    const finca = await findFincaOrFail(fincaUuid);
    assertFincaPermitida(user, finca.id);
    if (!descriptorValido(descriptor)) throw ApiError.badRequest('El vector facial no es válido (128 números)');
    const candidatos = await cargarCandidatos(finca.id);
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
    const candidatosPorFinca = new Map();
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
      if (!candidatosPorFinca.has(finca.id)) candidatosPorFinca.set(finca.id, await cargarCandidatos(finca.id));
      const candidatos = candidatosPorFinca.get(finca.id);
      if (candidatos.length === 0) {
        res('ERROR', { mensaje: 'No hay colaboradores con rostro registrado en esta finca' });
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
        res('DUPLICADA', { colaborador: { uuid: colaborador.uuid, nombre: colaborador.nombre }, mensaje: 'Ya hay una marcación igual hace menos de 2 minutos' });
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
      res('CREADA', { colaborador: { uuid: colaborador.uuid, nombre: colaborador.nombre }, distancia: redondear(r.mejor.distancia) });
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
        { model: Colaborador, as: 'colaborador', attributes: ['uuid', 'nombre', 'documento'] },
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
      colaborador: m.colaborador ? { uuid: m.colaborador.uuid, nombre: m.colaborador.nombre, documento: m.colaborador.documento } : null,
      finca: m.finca ? { uuid: m.finca.uuid, nombre: m.finca.nombre } : null,
      tipo: m.tipo,
      fechaHora: m.fechaHora,
      lat: m.lat === null ? null : Number(m.lat),
      lng: m.lng === null ? null : Number(m.lng),
      distancia: m.distancia === null ? null : Number(m.distancia),
      marcadoPor: nombreAutor.get(m.createdBy) || '',
    }));
    return { items, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async eliminar(uuid, actorId) {
    const marcacion = await AsistenciaMarcacion.findOne({ where: { uuid } });
    if (!marcacion) throw ApiError.notFound('Marcación no encontrada');
    await marcacion.update({ deletedBy: actorId });
    await marcacion.destroy();
  },
};

export default asistenciaService;
