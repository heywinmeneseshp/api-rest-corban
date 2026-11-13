import { Op } from 'sequelize';
import { sequelize } from '../../database/connection.js';
import { Equipo, EquipoTipo, LecturaEquipo, PlanMantenimiento, ProgramacionMantenimiento, User } from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../../utils/logger.js';
import { destinatariosAviso } from './mantenimientoAvisos.service.js';
import { configuracionService } from '../sistema/configuracion.service.js';
import { mailService } from '../sistema/mail.service.js';

// Mantenimiento por kilometraje y horas. El conductor registra la lectura del tablero al encender el equipo (web o app móvil); de ahí se calcula lo
// recorrido y cuándo toca el mantenimiento de los planes cuya periodicidad es en KILOMETROS, HORAS u HOROMETRO (drones = horas de vuelo).
const CAMPO_POR_UNIDAD = { KILOMETROS: 'kilometraje', HORAS: 'horometro', HOROMETRO: 'horometro' };
const UNIDAD_TEXTO = { kilometraje: 'km', horometro: 'h' };
export const PCT_AVISO = 0.1; // «próximo» cuando faltan 10 % o menos del intervalo
const ORDEN_AVISO = { PROXIMO: 1, VENCIDO: 2 };

export const esPlanPorLectura = (unidad) => Object.hasOwn(CAMPO_POR_UNIDAD, unidad);
export const campoDeUnidad = (unidad) => CAMPO_POR_UNIDAD[unidad] || null;

const num = (v) => (v === null || v === undefined ? null : Number(v));
const r2 = (n) => Math.round(n * 100) / 100;

// Estado del mantenimiento de un plan por lectura según la lectura actual del equipo. Sin lectura base aún no se puede calcular (SIN_BASE).
export function estadoLectura(plan, equipo) {
  const campo = campoDeUnidad(plan.periodicidadUnidad);
  if (!campo || !equipo) return null;
  const actual = num(equipo[campo]) ?? 0;
  const base = num(plan.lecturaBase);
  const intervalo = Number(plan.periodicidadValor);
  if (base === null) return { campo, unidad: UNIDAD_TEXTO[campo], lecturaActual: actual, lecturaBase: null, proximaLectura: null, faltan: null, estadoLectura: 'SIN_BASE' };
  const proxima = r2(base + intervalo);
  const faltan = r2(proxima - actual);
  const estado = faltan <= 0 ? 'VENCIDO' : faltan <= intervalo * PCT_AVISO ? 'PROXIMO' : 'AL_DIA';
  return { campo, unidad: UNIDAD_TEXTO[campo], lecturaActual: actual, lecturaBase: base, proximaLectura: proxima, faltan, estadoLectura: estado };
}

// Plan en JSON con su estado de lectura (los planes por días / meses no traen campos extra).
export function planConEstado(plan) {
  const json = typeof plan.toJSON === 'function' ? plan.toJSON() : plan;
  const e = estadoLectura(plan, plan.equipo);
  return e ? { ...json, ...e } : json;
}

async function buscarEquipo(uuid, transaction) {
  const e = await Equipo.findOne({ where: { uuid }, transaction });
  if (!e) throw ApiError.notFound('Equipo no encontrado');
  return e;
}

// Al cerrar una orden de mantenimiento de un plan por lectura, el ciclo vuelve a empezar desde la lectura actual del equipo.
export async function reiniciarCicloLectura(plan, equipoId, transaction) {
  const campo = campoDeUnidad(plan.periodicidadUnidad);
  if (!campo) return;
  const equipo = await Equipo.findByPk(equipoId, { transaction });
  if (!equipo) return;
  await plan.update({ lecturaBase: num(equipo[campo]) ?? 0, avisoEstado: null }, { transaction });
}

// Reevalúa los planes por lectura del equipo: sin base se toma la lectura actual; si pasan a PROXIMO / VENCIDO se agenda una programación (si no hay una
// abierta) y se devuelve lo que hay que avisar por correo (solo si el estado empeoró respecto al último aviso).
async function reevaluarPlanes(equipo, transaction) {
  const planes = await PlanMantenimiento.findAll({ where: { equipoId: equipo.id, estado: true, periodicidadUnidad: { [Op.in]: Object.keys(CAMPO_POR_UNIDAD) } }, transaction });
  const avisos = [];
  const resumen = [];
  for (const plan of planes) {
    const campo = campoDeUnidad(plan.periodicidadUnidad);
    if (num(plan.lecturaBase) === null) await plan.update({ lecturaBase: num(equipo[campo]) ?? 0 }, { transaction });
    const e = estadoLectura(plan, equipo);
    resumen.push({ planUuid: plan.uuid, plan: plan.nombre, ...e });
    if (e.estadoLectura === 'AL_DIA') {
      if (plan.avisoEstado) await plan.update({ avisoEstado: null }, { transaction });
      continue;
    }
    const abierta = await ProgramacionMantenimiento.findOne({ where: { planId: plan.id, estado: { [Op.in]: ['PENDIENTE', 'PROGRAMADA', 'EN_CURSO'] } }, transaction });
    if (!abierta) {
      const texto = e.estadoLectura === 'VENCIDO' ? `vencido hace ${Math.abs(e.faltan)} ${e.unidad}` : `faltan ${e.faltan} ${e.unidad}`;
      await ProgramacionMantenimiento.create(
        {
          planId: plan.id,
          equipoId: equipo.id,
          fechaProgramada: new Date().toISOString().slice(0, 10),
          estado: 'PROGRAMADA',
          prioridad: e.estadoLectura === 'VENCIDO' ? 'ALTA' : 'MEDIA',
          observaciones: `Por ${e.campo === 'kilometraje' ? 'kilometraje' : 'horas'}: ${texto} (próxima a ${e.proximaLectura} ${e.unidad}, lectura actual ${e.lecturaActual} ${e.unidad})`,
        },
        { transaction },
      );
    }
    if ((ORDEN_AVISO[e.estadoLectura] || 0) > (ORDEN_AVISO[plan.avisoEstado] || 0)) {
      await plan.update({ avisoEstado: e.estadoLectura }, { transaction });
      avisos.push({ plan: plan.nombre, ...e });
    }
  }
  return { avisos, resumen };
}

async function enviarAvisos(equipo, avisos) {
  if (avisos.length === 0) return;
  try {
    const destinatarios = await destinatariosAviso(await configuracionService.getMantenimientoDestinatarios(), { equipoId: equipo.id });
    if (destinatarios.length === 0) {
      logger.warn('Mantenimiento por lectura próximo o vencido, pero no hay destinatarios configurados', { equipo: equipo.codigo });
      return;
    }
    await mailService.sendMantenimientoLectura({ destinatarios, equipo: { codigo: equipo.codigo, nombre: equipo.nombre }, avisos });
  } catch (err) {
    logger.error('No se pudo enviar el aviso de mantenimiento por lectura', { message: err.message });
  }
}

const aFecha = (v) => {
  const f = v ? new Date(v) : new Date();
  if (Number.isNaN(f.getTime())) throw ApiError.badRequest('Fecha y hora inválidas');
  return f;
};

export const lecturaEquipoService = {
  // Registra una lectura (km y/o horas). Idempotente por `uuid`. Una lectura menor que la anterior se rechaza, salvo `corregir` (cambio de tablero).
  async registrar(equipoUuid, payload, user) {
    const campos = ['kilometraje', 'horometro'].filter((c) => payload[c] !== undefined && payload[c] !== null && payload[c] !== '');
    if (campos.length === 0) throw ApiError.badRequest('Escribe el kilometraje o las horas');
    const fechaHora = aFecha(payload.fechaHora);

    const resultado = await sequelize.transaction(async (transaction) => {
      const equipo = await buscarEquipo(equipoUuid, transaction);
      if (payload.uuid) {
        const ya = await LecturaEquipo.findOne({ where: { uuid: payload.uuid }, transaction });
        if (ya) return { duplicada: true, equipo, lectura: ya, avisos: [], resumen: [] };
      }
      const recorrido = {};
      const valores = {};
      const esUltima = {};
      for (const campo of campos) {
        const valor = Number(payload[campo]);
        if (!Number.isFinite(valor) || valor < 0) throw ApiError.badRequest('La lectura debe ser un número mayor o igual a 0');
        const previa = await LecturaEquipo.findOne({ where: { equipoId: equipo.id, [campo]: { [Op.ne]: null }, fechaHora: { [Op.lte]: fechaHora } }, order: [['fechaHora', 'DESC'], ['id', 'DESC']], transaction });
        const posterior = await LecturaEquipo.findOne({ where: { equipoId: equipo.id, [campo]: { [Op.ne]: null }, fechaHora: { [Op.gt]: fechaHora } }, transaction });
        // Referencia: la lectura anterior; si esta sería la más reciente, también lo guardado en el equipo (por ediciones manuales antiguas).
        const referencia = previa ? Number(previa[campo]) : !posterior ? num(equipo[campo]) : null;
        if (referencia !== null && valor < referencia && !payload.corregir) {
          throw ApiError.conflict(`La lectura (${valor}) es menor que la anterior (${referencia}). Revisa el tablero; si cambiaron el tablero, pide una corrección a un administrador.`);
        }
        recorrido[campo] = referencia !== null && valor >= referencia ? r2(valor - referencia) : null;
        valores[campo] = valor;
        esUltima[campo] = !posterior;
      }
      const lectura = await LecturaEquipo.create(
        {
          uuid: payload.uuid || undefined,
          equipoId: equipo.id,
          fechaHora,
          kilometraje: valores.kilometraje ?? null,
          horometro: valores.horometro ?? null,
          usuarioId: user?.id ?? null,
          origen: payload.origen === 'APP' ? 'APP' : 'WEB',
          nota: payload.nota ? String(payload.nota).slice(0, 300) : null,
        },
        { transaction },
      );
      // El equipo guarda la lectura más reciente (la de mayor fecha); una lectura atrasada que llega tarde no la pisa.
      const cambios = {};
      for (const campo of campos) if (esUltima[campo]) cambios[campo] = valores[campo];
      if (Object.keys(cambios).length) {
        await equipo.update(cambios, { transaction });
        await equipo.reload({ transaction });
      }
      const { avisos, resumen } = await reevaluarPlanes(equipo, transaction);
      return { duplicada: false, equipo, lectura, recorrido, avisos, resumen };
    });

    if (!resultado.duplicada) await enviarAvisos(resultado.equipo, resultado.avisos);
    return {
      duplicada: resultado.duplicada,
      uuid: resultado.lectura.uuid,
      recorrido: resultado.recorrido || null,
      equipo: { kilometraje: num(resultado.equipo.kilometraje), horometro: num(resultado.equipo.horometro) },
      planes: resultado.resumen,
    };
  },

  // Lote desde la app (cola offline): se procesan por fecha; cada elemento devuelve su resultado y uno que falla no corta a los demás.
  async registrarLote(items, user) {
    const ordenados = [...items].sort((a, b) => new Date(a.fechaHora || 0) - new Date(b.fechaHora || 0));
    const resultados = [];
    for (const item of ordenados) {
      try {
        const { equipoUuid, ...datos } = item;
        const r = await this.registrar(equipoUuid, { ...datos, origen: 'APP' }, user);
        resultados.push({ uuid: item.uuid, estado: r.duplicada ? 'DUPLICADA' : 'OK', recorrido: r.recorrido });
      } catch (err) {
        resultados.push({ uuid: item.uuid, estado: 'ERROR', mensaje: err.message });
      }
    }
    return resultados;
  },

  // Historial de un equipo con lo recorrido entre una lectura y la anterior (por cada magnitud).
  async historial(equipoUuid, { limite = 100 } = {}) {
    const equipo = await buscarEquipo(equipoUuid);
    const filas = await LecturaEquipo.findAll({
      where: { equipoId: equipo.id },
      include: [{ model: User, as: 'usuario', attributes: ['uuid', 'usuario', 'nombre', 'apellido'] }],
      order: [['fechaHora', 'DESC'], ['id', 'DESC']],
      limit: Math.min(Number(limite) || 100, 500) + 1,
    });
    const items = filas.map((f, i) => {
      const dif = (campo) => {
        if (f[campo] === null) return null;
        const anterior = filas.slice(i + 1).find((x) => x[campo] !== null);
        const d = anterior ? r2(Number(f[campo]) - Number(anterior[campo])) : null;
        return d !== null && d >= 0 ? d : null; // negativo = corrección de tablero: sin recorrido
      };
      return {
        uuid: f.uuid,
        fechaHora: f.fechaHora,
        kilometraje: num(f.kilometraje),
        horometro: num(f.horometro),
        recorridoKm: dif('kilometraje'),
        recorridoHoras: dif('horometro'),
        origen: f.origen,
        nota: f.nota,
        usuario: f.usuario ? { uuid: f.usuario.uuid, nombre: `${f.usuario.nombre || ''} ${f.usuario.apellido || ''}`.trim() || f.usuario.usuario } : null,
      };
    });
    return { equipo: { uuid: equipo.uuid, codigo: equipo.codigo, nombre: equipo.nombre, kilometraje: num(equipo.kilometraje), horometro: num(equipo.horometro) }, items: items.slice(0, Math.min(Number(limite) || 100, 500)) };
  },

  // Lista mínima para la app: equipos operativos con su última lectura y qué magnitud usan sus planes (km, horas o ambas si no tienen plan por lectura).
  async paraApp() {
    const equipos = await Equipo.findAll({
      where: { estado: { [Op.in]: ['OPERATIVO', 'MANTENIMIENTO'] } },
      attributes: ['id', 'uuid', 'codigo', 'nombre', 'kilometraje', 'horometro'],
      include: [
        { model: EquipoTipo, as: 'tipo', attributes: ['nombre'] },
        { model: PlanMantenimiento, as: 'planesMantenimiento', attributes: ['periodicidadUnidad', 'estado'], required: false, where: { estado: true } },
      ],
      order: [['nombre', 'ASC']],
    });
    return equipos.map((e) => {
      const usadas = new Set((e.planesMantenimiento || []).map((p) => campoDeUnidad(p.periodicidadUnidad)).filter(Boolean));
      return {
        uuid: e.uuid,
        codigo: e.codigo,
        nombre: e.nombre,
        tipo: e.tipo?.nombre || null,
        kilometraje: num(e.kilometraje),
        horometro: num(e.horometro),
        pide: usadas.size ? [...usadas] : ['kilometraje', 'horometro'],
      };
    });
  },
};

export default lecturaEquipoService;
