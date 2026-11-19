import { Op } from 'sequelize';
import { Finca, Semana, ProduccionSemanal, EstimacionFinca, Colaborador, User } from '../../database/associations.js';
import { configuracionRepository } from '../../repositories/sistema/configuracion.repository.js';
import { hectareasPorFincaYSemana } from './dashboard.service.js';
import { pronosticoService } from './pronostico.service.js';
import { comprobanteAspersionService } from './comprobanteAspersion.service.js';
import { ApiError } from '../../utils/ApiError.js';
import { assertFincaPermitida } from '../../utils/fincaScope.js';
import { logger } from '../../utils/logger.js';

// Informe fitosanitario trimestral del ICA (Sanidad Vegetal → Informe ICA).
// Períodos del formato: T1 feb-abr, T2 may-jul, T3 ago-oct, T4 nov-ene (enero del año siguiente).
// Los datos que el sistema no tiene (registro ICA, titular, ubicación, asistente técnico) se guardan por finca en
// configuraciones (clave `informe_ica_fincas`: { [fincaUuid]: datos }).
const CLAVE = 'informe_ica_fincas';
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// [{ anio, mes (1-12) }] de los 3 meses del trimestre `t` del año `anio` (desplazado `t` trimestres más si se pide el siguiente).
function mesesTrimestre(anio, t) {
  const base = (t - 1) * 3 + 2; // T1 empieza en febrero
  return [0, 1, 2].map((i) => {
    const m = base + i;
    return { anio: anio + Math.floor((m - 1) / 12), mes: ((m - 1) % 12) + 1 };
  });
}

const iso = (d) => String(d).slice(0, 10);
// Mes de una semana = el de su jueves (mismo criterio que la proyección).
function mesDeSemana(s) {
  const d = new Date(`${iso(s.fechaInicio)}T12:00:00Z`);
  const jueves = new Date(d.getTime() + ((4 - d.getUTCDay() + 7) % 7) * 86400000);
  return { anio: jueves.getUTCFullYear(), mes: jueves.getUTCMonth() + 1 };
}
const hoyBogota = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);

async function leerTodos() {
  const c = await configuracionRepository.findByClave(CLAVE);
  try {
    const v = c?.valor ? JSON.parse(c.valor) : {};
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

async function cargarFinca(fincaUuid, user) {
  const finca = await Finca.findOne({ where: { uuid: fincaUuid }, attributes: ['id', 'uuid', 'codigo', 'nombre'] });
  if (!finca) throw ApiError.notFound('Finca no encontrada');
  assertFincaPermitida(user, finca.id);
  return finca;
}

// Datos del asistente técnico prellenados con el usuario actual y su ficha de colaborador (si está vinculada).
async function asistenteDelUsuario(user) {
  if (!user?.id) return {};
  const [u, colab] = await Promise.all([
    User.findByPk(user.id, { attributes: ['nombre', 'apellido', 'email'] }),
    Colaborador.findOne({ where: { userId: user.id }, attributes: ['nombre', 'apellido', 'documento', 'telefono', 'email'] }),
  ]);
  const nombre = [colab?.nombre || u?.nombre, colab?.apellido || u?.apellido].filter(Boolean).join(' ').trim();
  return {
    asistenteNombre: nombre,
    asistenteDocumento: colab?.documento || '',
    asistenteTelefono: colab?.telefono || '',
    asistenteCorreo: colab?.email || u?.email || '',
  };
}

const DEFAULTS = {
  registroIca: '',
  titular: '',
  telefono: '',
  correo: '',
  departamento: '',
  municipio: '',
  vereda: '',
  areaRegistrada: null,
  asistenteNombre: '',
  asistenteDocumento: '',
  asistenteTarjeta: '',
  asistenteCursoSv: 'SI',
  asistenteSensorExterno: 'NO',
  asistenteTelefono: '',
  asistenteCorreo: '',
  exportador: 'C.I. BANA RICA S.A.',
};

// Cajas 20 kg por mes: real si la semana ya terminó y tiene producción; si no, la última estimación de la finca; si no, la proyectada.
async function cajasPorMes(finca, meses, user) {
  const claves = new Set(meses.map((m) => `${m.anio}-${m.mes}`));
  const primero = meses[0];
  const ultimo = meses[meses.length - 1];
  const desde = new Date(Date.UTC(primero.anio, primero.mes - 1, 1) - 7 * 86400000).toISOString().slice(0, 10);
  const hasta = new Date(Date.UTC(ultimo.anio, ultimo.mes, 0) + 86400000).toISOString().slice(0, 10);
  const semanas = (await Semana.findAll({ where: { fechaInicio: { [Op.gte]: desde, [Op.lte]: hasta } }, attributes: ['id', 'uuid', 'codigo', 'fechaInicio', 'fechaFin'], order: [['fechaInicio', 'ASC']] }))
    .map((s) => ({ ...s.get({ plain: true }), ...mesDeSemana(s) }))
    .filter((s) => claves.has(`${s.anio}-${s.mes}`));
  const ids = semanas.map((s) => s.id);
  const [reales, estimaciones] = ids.length
    ? await Promise.all([
        ProduccionSemanal.findAll({ where: { fincaId: finca.id, semanaId: ids }, attributes: ['semanaId', 'cajas20kg'], raw: true }),
        EstimacionFinca.findAll({ where: { fincaId: finca.id, semanaId: ids }, attributes: ['semanaId', 'cajas20kg', 'semanaRegistroId', 'id'], order: [['id', 'ASC']], raw: true }),
      ])
    : [[], []];
  const real = new Map();
  for (const r of reales) real.set(r.semanaId, (real.get(r.semanaId) || 0) + Number(r.cajas20kg));
  // La última registrada (por id) gana.
  const estim = new Map();
  for (const e of estimaciones) estim.set(e.semanaId, Number(e.cajas20kg));

  const hoy = hoyBogota();
  const fuente = new Map();
  const faltan = [];
  for (const s of semanas) {
    if (real.has(s.id) && iso(s.fechaFin) < hoy) fuente.set(s.id, { cajas: real.get(s.id), fuente: 'real' });
    else if (real.has(s.id) && !estim.has(s.id)) fuente.set(s.id, { cajas: real.get(s.id), fuente: 'real' });
    else if (estim.has(s.id)) fuente.set(s.id, { cajas: estim.get(s.id), fuente: 'estimado' });
    else if (iso(s.fechaFin) < hoy) fuente.set(s.id, { cajas: 0, fuente: 'real' });
    else faltan.push(s);
  }
  if (faltan.length) {
    try {
      const desdeSemana = faltan.reduce((a, s) => (iso(s.fechaInicio) < hoy ? a : a || s), null) || faltan[0];
      const n = Math.round((new Date(iso(faltan[faltan.length - 1].fechaInicio)) - new Date(iso(desdeSemana.fechaInicio))) / (7 * 86400000)) + 1;
      const pron = await pronosticoService.getPronostico({ fincaUuids: finca.uuid, semanaInicioUuid: desdeSemana.uuid, semanas: Math.min(60, Math.max(1, n)) }, user);
      const porCodigo = new Map((pron.rows || []).map((r) => [r.semanaCodigo, Number(r.cajasProyectada ?? r.cajasTotal ?? 0) || 0]));
      for (const s of faltan) if (porCodigo.get(s.codigo) > 0) fuente.set(s.id, { cajas: porCodigo.get(s.codigo), fuente: 'proyectado' });
    } catch (error) {
      logger.warn('Informe ICA: no se pudo calcular la proyección', { message: error.message });
    }
    // Más allá del horizonte de la proyección (aún no hay embolse): la producción de la misma semana del año anterior.
    const sinDato = faltan.filter((s) => !fuente.has(s.id));
    if (sinDato.length) {
      const anteriores = await Semana.findAll({ where: { [Op.or]: sinDato.map((s) => ({ anio: Number(s.codigo.slice(-4)) - 1, numeroSemana: Number(s.codigo.slice(1, 3)) })) }, attributes: ['id', 'anio', 'numeroSemana'], raw: true });
      const prod = anteriores.length ? await ProduccionSemanal.findAll({ where: { fincaId: finca.id, semanaId: anteriores.map((x) => x.id) }, attributes: ['semanaId', 'cajas20kg'], raw: true }) : [];
      const porNumero = new Map();
      for (const a of anteriores) porNumero.set(a.numeroSemana, prod.filter((p) => p.semanaId === a.id).reduce((t, p) => t + Number(p.cajas20kg), 0));
      for (const s of sinDato) fuente.set(s.id, { cajas: porNumero.get(Number(s.codigo.slice(1, 3))) || 0, fuente: 'año anterior' });
    }
  }

  return meses.map((m) => {
    const sem = semanas.filter((s) => s.anio === m.anio && s.mes === m.mes);
    const fuentes = new Set(sem.map((s) => fuente.get(s.id)?.fuente).filter(Boolean));
    const cajas = sem.reduce((a, s) => a + (fuente.get(s.id)?.cajas || 0), 0);
    return {
      anio: m.anio,
      mes: m.mes,
      nombre: MESES[m.mes - 1],
      semanas: sem.map((s) => s.codigo),
      cajas20: Math.round(cajas),
      fuente: fuentes.size === 1 ? [...fuentes][0] : fuentes.size ? 'mixto' : 'sin datos',
      detalleFuentes: sem.map((s) => ({ semana: s.codigo, ...fuente.get(s.id) })),
    };
  });
}

export const informeIcaService = {
  async get({ fincaUuid, anio, trimestre }, user) {
    const finca = await cargarFinca(fincaUuid, user);
    const a = Number(anio);
    const t = Number(trimestre);
    const meses = mesesTrimestre(a, t);
    const siguientes = t === 4 ? mesesTrimestre(a + 1, 1) : mesesTrimestre(a, t + 1);
    const todos = await leerTodos();
    const guardados = todos[finca.uuid] || null;
    const datosIca = { ...DEFAULTS, ...(guardados ? {} : await asistenteDelUsuario(user)), ...(guardados || {}) };

    // Área en producción vigente al final del trimestre (o hoy, si aún no termina).
    const finTrimestre = new Date(Date.UTC(meses[2].anio, meses[2].mes, 0)).toISOString().slice(0, 10);
    const ref = finTrimestre < hoyBogota() ? finTrimestre : hoyBogota();
    const semanaRef = await Semana.findOne({ where: { fechaInicio: { [Op.lte]: ref } }, order: [['fechaInicio', 'DESC']], attributes: ['id', 'fechaInicio', 'fechaFin'] });
    let areaProduccion = null;
    if (semanaRef) {
      const ha = await hectareasPorFincaYSemana([finca.id], [semanaRef.get({ plain: true })]);
      areaProduccion = ha.get(finca.id)?.get(semanaRef.id) ?? null;
    }

    const [produccion, pronostico] = await Promise.all([cajasPorMes(finca, meses, user), cajasPorMes(finca, siguientes, user)]);

    // Aplicaciones químicas: comprobantes no anulados de la finca ejecutados en el trimestre; producto = insumo principal.
    const fechaDesde = new Date(Date.UTC(meses[0].anio, meses[0].mes - 1, 1)).toISOString().slice(0, 10);
    const { items: lista } = await comprobanteAspersionService.list({ fincaUuid: finca.uuid, fechaDesde, fechaHasta: finTrimestre, limit: 500 }, user);
    // El listado no trae los insumos: se carga el detalle de cada comprobante.
    const items = [];
    for (const c of lista.filter((x) => x.estado !== 'ANULADO' && x.ejecutadoEn)) items.push(await comprobanteAspersionService.getByUuid(c.uuid, user));
    const aplicaciones = items
      .map((c) => {
        const principal = (c.insumos || []).find((i) => i.esPrincipal) || (c.insumos || [])[0] || null;
        const ha = Number(c.aspersion?.hectareas || c.hectareasAplicadas || 0);
        const dosis = principal?.cantidad !== null && principal?.cantidad !== undefined && ha > 0 ? Math.round((principal.cantidad / ha) * 1000) / 1000 : null;
        return {
          comprobante: c.numero,
          fecha: new Date(new Date(c.ejecutadoEn).getTime() - 5 * 3600 * 1000).toISOString().slice(0, 10),
          producto: principal?.nombre || '—',
          dosis,
          unidad: principal?.unidad?.simbolo || principal?.unidad?.nombre || '',
          hectareas: ha || null,
        };
      })
      .sort((x, y) => (x.fecha < y.fecha ? -1 : x.fecha > y.fecha ? 1 : 0));

    return {
      finca: { uuid: finca.uuid, codigo: finca.codigo, nombre: finca.nombre },
      anio: a,
      trimestre: t,
      datosIca,
      datosGuardados: Boolean(guardados),
      areaProduccion,
      produccion,
      pronostico,
      aplicaciones,
    };
  },

  async guardarDatos({ fincaUuid, datos }, actorId, user) {
    const finca = await cargarFinca(fincaUuid, user);
    const todos = await leerTodos();
    const limpio = {};
    for (const k of Object.keys(DEFAULTS)) if (datos[k] !== undefined) limpio[k] = datos[k];
    todos[finca.uuid] = { ...DEFAULTS, ...(todos[finca.uuid] || {}), ...limpio };
    await configuracionRepository.upsert(CLAVE, JSON.stringify(todos), actorId);
    return todos[finca.uuid];
  },
};
