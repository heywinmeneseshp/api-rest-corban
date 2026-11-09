import { Op } from 'sequelize';
import { sequelize } from '../../database/connection.js';
import { Colaborador, AsistenciaNovedad } from '../../database/associations.js';
import { alcanceColaboradores, MODULOS_COLABORADOR } from './colaborador.service.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { diasHabiles } from '../../utils/festivosColombia.js';

// Novedades de asistencia: ausencias justificadas y compensatorios en horas. El saldo de compensatorio es ganado − tomado.
export const HORAS_JORNADA = 8; // un día de compensatorio equivale a estas horas
const COMPENSATORIOS = ['COMPENSATORIO_GANADO', 'COMPENSATORIO_TOMADO'];
// El compensatorio ganado no es una ausencia: se gana trabajando.
const AUSENCIAS = ['VACACIONES', 'COMPENSATORIO_TOMADO', 'INCAPACIDAD', 'PERMISO_REMUNERADO', 'PERMISO_NO_REMUNERADO', 'LICENCIA', 'CALAMIDAD'];
const MS_DIA = 86400000;

const nombreCompleto = (c) => `${c.nombre} ${c.apellido || ''}`.trim();
const dia = (f) => (f instanceof Date ? f.toISOString().slice(0, 10) : String(f).slice(0, 10));
const diasEntre = (desde, hasta) => Math.round((new Date(`${hasta}T12:00:00Z`) - new Date(`${desde}T12:00:00Z`)) / MS_DIA) + 1;
const COLABORADOR_ATTRS = ['id', 'uuid', 'nombre', 'apellido', 'documento', 'cargo', 'fincaId', 'lugarId', 'modulo', 'userId', 'fechaIngreso', 'vacacionesPrevias'];
export const DIAS_VACACIONES_ANIO = 15; // días hábiles por año trabajado
const hoy = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
const r2 = (n) => Math.round(n * 100) / 100;

// Colaboradores que el usuario puede ver (sus fincas), con filtro opcional de módulo y de texto.
export function whereColaboradores(query, user) {
  const partes = [];
  const alcance = alcanceColaboradores(user, 'ver', MODULOS_COLABORADOR.includes(query?.modulo) ? query.modulo : null, { porPermisos: false });
  if (alcance) partes.push(alcance);
  const texto = String(query?.search || '').trim();
  if (texto) {
    const like = { [Op.like]: `%${texto}%` };
    partes.push({
      [Op.or]: [{ nombre: like }, { apellido: like }, { documento: like }, sequelize.where(sequelize.fn('CONCAT_WS', ' ', sequelize.col('nombre'), sequelize.col('apellido')), like)],
    });
  }
  return partes.length ? { [Op.and]: partes } : {};
}

const aDto = (n) => {
  const desde = dia(n.fechaDesde);
  const hasta = dia(n.fechaHasta);
  return {
    uuid: n.uuid,
    tipo: n.tipo,
    fechaDesde: desde,
    fechaHasta: hasta,
    dias: diasEntre(desde, hasta),
    diasHabiles: n.tipo === 'VACACIONES' ? diasHabiles(desde, hasta) : null,
    horas: n.horas === null ? null : Number(n.horas),
    referencia: n.referencia,
    observaciones: n.observaciones,
    colaborador: n.colaborador
      ? { uuid: n.colaborador.uuid, nombre: nombreCompleto(n.colaborador), documento: n.colaborador.documento, cargo: n.colaborador.cargo || null }
      : null,
  };
};

async function saldoHoras(colaboradorId, { excluirId = null, transaction } = {}) {
  const filas = await AsistenciaNovedad.findAll({
    where: { colaboradorId, tipo: COMPENSATORIOS, ...(excluirId ? { id: { [Op.ne]: excluirId } } : {}) },
    attributes: ['tipo', 'horas'],
    transaction,
  });
  return filas.reduce((s, f) => s + (f.tipo === 'COMPENSATORIO_GANADO' ? 1 : -1) * Number(f.horas || 0), 0);
}

// Vacaciones (días hábiles): causadas = 15 por año desde el ingreso, proporcional día a día hasta hoy; tomadas = las
// disfrutadas antes del sistema + las registradas.
async function saldoVacaciones(colaborador, { excluirId = null } = {}) {
  if (!colaborador.fechaIngreso) return null;
  const ingreso = dia(colaborador.fechaIngreso);
  const dias = Math.max(0, diasEntre(ingreso, hoy()) - 1);
  const causadas = (DIAS_VACACIONES_ANIO * dias) / 365;
  const filas = await AsistenciaNovedad.findAll({
    where: { colaboradorId: colaborador.id, tipo: 'VACACIONES', ...(excluirId ? { id: { [Op.ne]: excluirId } } : {}) },
    attributes: ['fechaDesde', 'fechaHasta'],
  });
  const tomadas = Number(colaborador.vacacionesPrevias || 0) + filas.reduce((s, f) => s + diasHabiles(dia(f.fechaDesde), dia(f.fechaHasta)), 0);
  return { ingreso, causadas: r2(causadas), tomadas: r2(tomadas), disponibles: r2(causadas - tomadas) };
}

async function colaboradorEnAlcance(uuid, user) {
  const c = await Colaborador.findOne({ where: { uuid, ...whereColaboradores({}, user) }, attributes: COLABORADOR_ATTRS });
  if (!c) throw ApiError.notFound('Colaborador no encontrado');
  return c;
}

// Normaliza y valida los datos de una novedad (`existente` al editar).
async function validar(datos, colaboradorId, existente = null) {
  const tipo = datos.tipo ?? existente?.tipo;
  const desde = dia(datos.fechaDesde ?? existente?.fechaDesde);
  const hasta = dia(datos.fechaHasta ?? existente?.fechaHasta);
  if (hasta < desde) throw ApiError.badRequest('La fecha final no puede ser anterior a la inicial');
  const esCompensatorio = COMPENSATORIOS.includes(tipo);
  let horas = datos.horas !== undefined ? datos.horas : existente?.horas;
  horas = horas === null || horas === undefined || horas === '' ? null : Number(horas);
  if (esCompensatorio && !(horas > 0)) throw ApiError.badRequest('Indica las horas del compensatorio');
  if (!esCompensatorio) horas = null;

  if (AUSENCIAS.includes(tipo)) {
    const cruce = await AsistenciaNovedad.findOne({
      where: {
        colaboradorId,
        tipo: AUSENCIAS,
        fechaDesde: { [Op.lte]: hasta },
        fechaHasta: { [Op.gte]: desde },
        ...(existente ? { id: { [Op.ne]: existente.id } } : {}),
      },
    });
    if (cruce) throw ApiError.badRequest(`Ya tiene una novedad en esas fechas (${dia(cruce.fechaDesde)} a ${dia(cruce.fechaHasta)})`);
  }
  if (tipo === 'COMPENSATORIO_TOMADO') {
    const saldo = await saldoHoras(colaboradorId, { excluirId: existente?.id });
    if (horas > saldo + 1e-9) throw ApiError.badRequest(`No tiene horas suficientes de compensatorio: el saldo es ${Math.round(saldo * 100) / 100} h`);
  }
  return {
    tipo,
    fechaDesde: desde,
    fechaHasta: hasta,
    horas,
    referencia: (datos.referencia !== undefined ? datos.referencia : existente?.referencia)?.toString().trim() || null,
    observaciones: (datos.observaciones !== undefined ? datos.observaciones : existente?.observaciones)?.toString().trim() || null,
  };
}

async function novedadEnAlcance(uuid, user) {
  const n = await AsistenciaNovedad.findOne({
    where: { uuid },
    include: [{ model: Colaborador, as: 'colaborador', attributes: COLABORADOR_ATTRS, required: true, where: whereColaboradores({}, user), paranoid: false }],
  });
  if (!n) throw ApiError.notFound('Novedad no encontrada');
  return n;
}

export const asistenciaNovedadService = {
  async listar(query, user) {
    const { page, limit, offset } = getPagination(query);
    const where = {};
    if (query.tipo) where.tipo = query.tipo;
    if (query.desde) where.fechaHasta = { [Op.gte]: dia(query.desde) };
    if (query.hasta) where.fechaDesde = { [Op.lte]: dia(query.hasta) };
    const { rows, count } = await AsistenciaNovedad.findAndCountAll({
      where,
      limit,
      offset,
      order: [['fechaDesde', 'DESC'], ['id', 'DESC']],
      include: [{ model: Colaborador, as: 'colaborador', attributes: COLABORADOR_ATTRS, required: true, where: whereColaboradores(query, user), paranoid: false }],
    });
    return { items: rows.map(aDto), meta: buildPaginationMeta({ page, limit, total: count }), horasJornada: HORAS_JORNADA };
  },

  async crear(payload, actorId, user) {
    const colaborador = await colaboradorEnAlcance(payload.colaboradorUuid, user);
    const datos = await validar(payload, colaborador.id);
    const n = await AsistenciaNovedad.create({ ...datos, colaboradorId: colaborador.id, createdBy: actorId });
    return aDto(await novedadEnAlcance(n.uuid, user));
  },

  async actualizar(uuid, payload, actorId, user) {
    const n = await novedadEnAlcance(uuid, user);
    const datos = await validar(payload, n.colaboradorId, n);
    await n.update({ ...datos, updatedBy: actorId });
    return aDto(await novedadEnAlcance(uuid, user));
  },

  async eliminar(uuid, actorId, user) {
    const n = await novedadEnAlcance(uuid, user);
    // Quitar un compensatorio ganado no puede dejar el saldo negativo.
    if (n.tipo === 'COMPENSATORIO_GANADO' && (await saldoHoras(n.colaboradorId, { excluirId: n.id })) < -1e-9) {
      throw ApiError.badRequest('No se puede eliminar: esas horas ya se tomaron como descanso');
    }
    await n.update({ deletedBy: actorId });
    await n.destroy();
  },

  // Por colaborador: horas de compensatorio (ganadas, tomadas, saldo) y días hábiles de vacaciones (causadas, tomadas, disponibles).
  async saldos(query, user) {
    const colaboradores = await Colaborador.findAll({ where: { estado: true, ...whereColaboradores(query, user) }, attributes: COLABORADOR_ATTRS });
    const ids = colaboradores.map((c) => c.id);
    const novedades = ids.length
      ? await AsistenciaNovedad.findAll({ where: { colaboradorId: ids, tipo: [...COMPENSATORIOS, 'VACACIONES'] }, attributes: ['colaboradorId', 'tipo', 'horas', 'fechaDesde', 'fechaHasta'] })
      : [];
    const porColaborador = new Map(ids.map((id) => [id, []]));
    for (const n of novedades) porColaborador.get(n.colaboradorId).push(n);
    const items = colaboradores
      .map((c) => {
        const lista = porColaborador.get(c.id);
        const ganadas = lista.filter((n) => n.tipo === 'COMPENSATORIO_GANADO').reduce((s, n) => s + Number(n.horas || 0), 0);
        const tomadas = lista.filter((n) => n.tipo === 'COMPENSATORIO_TOMADO').reduce((s, n) => s + Number(n.horas || 0), 0);
        let vacaciones = null;
        if (c.fechaIngreso) {
          const ingreso = dia(c.fechaIngreso);
          const causadas = (DIAS_VACACIONES_ANIO * Math.max(0, diasEntre(ingreso, hoy()) - 1)) / 365;
          const vTomadas =
            Number(c.vacacionesPrevias || 0) + lista.filter((n) => n.tipo === 'VACACIONES').reduce((s, n) => s + diasHabiles(dia(n.fechaDesde), dia(n.fechaHasta)), 0);
          vacaciones = { ingreso, causadas: r2(causadas), tomadas: r2(vTomadas), disponibles: r2(causadas - vTomadas) };
        }
        return {
          colaborador: { uuid: c.uuid, nombre: nombreCompleto(c), documento: c.documento, cargo: c.cargo || null },
          ganadas: r2(ganadas),
          tomadas: r2(tomadas),
          saldo: r2(ganadas - tomadas),
          saldoDias: r2((ganadas - tomadas) / HORAS_JORNADA),
          vacaciones,
        };
      })
      .sort((a, b) => a.colaborador.nombre.localeCompare(b.colaborador.nombre, 'es'));
    return { horasJornada: HORAS_JORNADA, diasVacacionesAnio: DIAS_VACACIONES_ANIO, items };
  },

  // Saldo de un colaborador (para el formulario al tomar compensatorio).
  // `desde`/`hasta` opcionales: días hábiles de ese rango (para el formulario de vacaciones).
  async saldoDe(colaboradorUuid, user, { desde, hasta, excluirUuid } = {}) {
    const c = await colaboradorEnAlcance(colaboradorUuid, user);
    const excluir = excluirUuid ? await AsistenciaNovedad.findOne({ where: { uuid: excluirUuid }, attributes: ['id'] }) : null;
    return {
      saldo: r2(await saldoHoras(c.id, { excluirId: excluir?.id })),
      horasJornada: HORAS_JORNADA,
      vacaciones: await saldoVacaciones(c, { excluirId: excluir?.id }),
      diasHabiles: desde && hasta && dia(hasta) >= dia(desde) ? diasHabiles(dia(desde), dia(hasta)) : null,
    };
  },

  // Colaboradores activos para elegir en el formulario.
  async colaboradores(user) {
    const filas = await Colaborador.findAll({ where: { estado: true, ...whereColaboradores({}, user) }, attributes: COLABORADOR_ATTRS, order: [['nombre', 'ASC'], ['apellido', 'ASC']] });
    return filas.map((c) => ({ uuid: c.uuid, nombre: nombreCompleto(c), documento: c.documento, cargo: c.cargo || null }));
  },

  // Ausencias por día entre dos fechas: Map 'colaboradorId|AAAA-MM-DD' → tipo, y la lista con el colaborador.
  async ausenciasEn(desde, hasta) {
    const filas = await AsistenciaNovedad.findAll({
      where: { tipo: AUSENCIAS, fechaDesde: { [Op.lte]: hasta }, fechaHasta: { [Op.gte]: desde } },
      include: [{ model: Colaborador, as: 'colaborador', attributes: COLABORADOR_ATTRS, paranoid: false }],
    });
    const porDia = new Map();
    for (const n of filas) {
      const inicio = dia(n.fechaDesde) > desde ? dia(n.fechaDesde) : desde;
      const fin = dia(n.fechaHasta) < hasta ? dia(n.fechaHasta) : hasta;
      for (let ms = new Date(`${inicio}T12:00:00Z`).getTime(); ms <= new Date(`${fin}T12:00:00Z`).getTime(); ms += MS_DIA) {
        porDia.set(`${n.colaboradorId}|${new Date(ms).toISOString().slice(0, 10)}`, { tipo: n.tipo, colaborador: n.colaborador });
      }
    }
    return porDia;
  },
};

export default asistenciaNovedadService;
