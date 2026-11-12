import { TipoEvaluacion, Finca, Lote, Semana, User, Role } from '../../database/associations.js';
import { userRepository } from '../../repositories/seguridad/user.repository.js';
import { ROLES } from '../../constants/roles.constants.js';
import { objetivoEvaluacionRepository } from '../../repositories/agricola/objetivoEvaluacion.repository.js';
import { evaluacionRepository } from '../../repositories/agricola/evaluacion.repository.js';
import { semanaRepository } from '../../repositories/agricola/semana.repository.js';
import { Op } from 'sequelize';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { assertFincaPermitida, getFincaIdsPermitidas, expandirFincaIds } from '../../utils/fincaScope.js';
import { sequelize } from '../../database/connection.js';
import { semanasEntre } from '../../utils/edadPlanta.js';
import { configuracionService } from '../sistema/configuracion.service.js';
import { mailService } from '../sistema/mail.service.js';
import { logger } from '../../utils/logger.js';

const CONTEO_HOJAS_NOMBRE = 'Conteo de Hojas';

const findTipoEvaluacionByUuidOrFail = async (uuid) => {
  const tipo = await TipoEvaluacion.findOne({ where: { uuid } });
  if (!tipo) throw ApiError.notFound('Tipo de evaluación no encontrado');
  return tipo;
};

const findFincaByUuidOrFail = async (uuid) => {
  const finca = await Finca.findOne({ where: { uuid } });
  if (!finca) throw ApiError.notFound('Finca no encontrada');
  return finca;
};

const findLoteByUuidOrFail = async (uuid) => {
  const lote = await Lote.findOne({ where: { uuid } });
  if (!lote) throw ApiError.notFound('Lote no encontrado');
  return lote;
};

// Valida que venga exactamente uno de fincaUuid/loteUuid, resuelve sus ids
// y limpia edadMinima/edadMaxima si el tipo no es "Conteo de Hojas".
const resolverAmbitoYEdad = async (payload, tipoEvaluacion) => {
  if (Boolean(payload.fincaUuid) === Boolean(payload.loteUuid)) {
    throw ApiError.badRequest('Debes indicar exactamente una finca o un lote, no ambos ni ninguno');
  }
  const fincaId = payload.fincaUuid ? (await findFincaByUuidOrFail(payload.fincaUuid)).id : null;
  const loteId = payload.loteUuid ? (await findLoteByUuidOrFail(payload.loteUuid)).id : null;

  const esConteoHojas = tipoEvaluacion.nombre === CONTEO_HOJAS_NOMBRE;
  const edadMinima = esConteoHojas ? payload.edadMinima ?? null : null;
  const edadMaxima = esConteoHojas ? payload.edadMaxima ?? null : null;
  if (edadMinima !== null && edadMaxima !== null && edadMinima > edadMaxima) {
    throw ApiError.badRequest('La edad mínima no puede ser mayor que la edad máxima');
  }

  return { fincaId, loteId, edadMinima, edadMaxima };
};

// Edad (semanas desde embolse) de una evaluación de Conteo de Hojas, o
// null si no se puede calcular (falta semanaEmbolse o semana).
const edadDe = (ev) => {
  const embolse = ev.conteoHojas?.semanaEmbolse;
  if (!embolse || !ev.semana) return null;
  return semanasEntre(embolse.fechaInicio, ev.semana.fechaInicio);
};

// Progreso de un objetivo dentro de un conjunto de evaluaciones ya traído
// por evaluacionRepository.findAllPorSemana. Cuando el objetivo tiene un
// rango de edad completo (edadMinima Y edadMaxima), la `cantidad` es la
// meta POR CADA edad del rango por separado (no un total combinado) — se
// evalúa cada semana de edad como si fuera su propio objetivo y se suman
// los resultados, devolviendo también el detalle por edad.
const construirProgreso = (evaluaciones, objetivo) => {
  const evsTipo = evaluaciones.filter((ev) => ev.tipoEvaluacion?.nombre === objetivo.tipoEvaluacion?.nombre);

  if (objetivo.edadMinima !== null && objetivo.edadMaxima !== null) {
    const detalleEdades = [];
    let realizadas = 0;
    let faltan = 0;
    for (let edad = objetivo.edadMinima; edad <= objetivo.edadMaxima; edad += 1) {
      const realizadasEdad = evsTipo.filter((ev) => edadDe(ev) === edad).length;
      const faltanEdad = Math.max(0, objetivo.cantidad - realizadasEdad);
      detalleEdades.push({ edad, cantidad: objetivo.cantidad, realizadas: realizadasEdad, faltan: faltanEdad });
      realizadas += realizadasEdad;
      faltan += faltanEdad;
    }
    return { realizadas, faltan, detalleEdades };
  }

  // Sin rango de edad completo (ninguno de los dos extremos, o un tipo
  // distinto a Conteo de Hojas): conteo combinado simple contra `cantidad`.
  let n = 0;
  for (const ev of evsTipo) {
    if (objetivo.edadMinima !== null || objetivo.edadMaxima !== null) {
      const edad = edadDe(ev);
      if (edad === null) continue;
      if (objetivo.edadMinima !== null && edad < objetivo.edadMinima) continue;
      if (objetivo.edadMaxima !== null && edad > objetivo.edadMaxima) continue;
    }
    n += 1;
  }
  return { realizadas: n, faltan: Math.max(0, objetivo.cantidad - n), detalleEdades: null };
};

const mismoRango = (a, b) => (a.edadMinima ?? null) === (b.edadMinima ?? null) && (a.edadMaxima ?? null) === (b.edadMaxima ?? null);

// No puede haber dos objetivos activos del mismo tipo, mismo ámbito y mismo rango de edades.
const assertSinDuplicado = async ({ tipoEvaluacionId, fincaId, loteId, edadMinima, edadMaxima }, exceptoId = null, transaction) => {
  const otros = await objetivoEvaluacionRepository.findPorTipoYAmbito({ tipoEvaluacionId, fincaId, loteId, soloActivos: true }, { transaction });
  if (otros.some((o) => o.id !== exceptoId && mismoRango(o, { edadMinima, edadMaxima }))) {
    throw ApiError.conflict('Ya existe un objetivo activo igual (mismo tipo, mismo ámbito y mismo rango de edades)');
  }
};

// Alcance por fincas asignadas del usuario: la finca del objetivo, o la del lote.
const assertAmbitoPermitido = async (fincaId, loteId, user) => {
  if (!user) return;
  if (fincaId) return assertFincaPermitida(user, fincaId);
  const lote = await Lote.findByPk(loteId, { attributes: ['id', 'fincaId'] });
  if (lote) assertFincaPermitida(user, lote.fincaId);
};

// Precedencia lote > finca: si el lote tiene objetivo propio de un tipo, el de la finca para ese tipo no aplica (nunca se suman).
const aplicarPrecedencia = (objetivos) => {
  const tiposConLote = new Set(objetivos.filter((o) => o.loteId).map((o) => o.tipoEvaluacionId));
  return objetivos.filter((o) => o.loteId || !tiposConLote.has(o.tipoEvaluacionId));
};

export const objetivoEvaluacionService = {
  async listObjetivos(query, user) {
    const { page, limit, offset } = getPagination(query);
    const fincaId = query.fincaUuid ? (await findFincaByUuidOrFail(query.fincaUuid)).id : undefined;
    const loteId = query.loteUuid ? (await findLoteByUuidOrFail(query.loteUuid)).id : undefined;
    const tipoEvaluacionId = query.tipoEvaluacionUuid
      ? (await findTipoEvaluacionByUuidOrFail(query.tipoEvaluacionUuid)).id
      : undefined;

    const { rows, count } = await objetivoEvaluacionRepository.findAndCountAll({
      limit,
      offset,
      fincaId,
      loteId,
      tipoEvaluacionId,
      estado: query.estado === undefined ? undefined : query.estado === true || query.estado === 'true',
      fincaIds: getFincaIdsPermitidas(user),
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getObjetivoByUuid(uuid) {
    const objetivo = await objetivoEvaluacionRepository.findByUuid(uuid);
    if (!objetivo) throw ApiError.notFound('Objetivo no encontrado');
    return objetivo;
  },

  async createObjetivo(payload, actorId, user) {
    const tipoEvaluacion = await findTipoEvaluacionByUuidOrFail(payload.tipoEvaluacionUuid);
    const { fincaId, loteId, edadMinima, edadMaxima } = await resolverAmbitoYEdad(payload, tipoEvaluacion);
    await assertAmbitoPermitido(fincaId, loteId, user);
    if (payload.estado ?? true) await assertSinDuplicado({ tipoEvaluacionId: tipoEvaluacion.id, fincaId, loteId, edadMinima, edadMaxima });

    return objetivoEvaluacionRepository.create({
      tipoEvaluacionId: tipoEvaluacion.id,
      fincaId,
      loteId,
      cantidad: payload.cantidad,
      edadMinima,
      edadMaxima,
      estado: payload.estado ?? true,
      createdBy: actorId,
    });
  },

  async updateObjetivo(uuid, payload, actorId, user) {
    const objetivo = await this.getObjetivoByUuid(uuid);
    await assertAmbitoPermitido(objetivo.fincaId, objetivo.loteId, user);
    const data = { updatedBy: actorId };

    const tipoEvaluacionUuid = payload.tipoEvaluacionUuid;
    const tipoEvaluacion = tipoEvaluacionUuid
      ? await findTipoEvaluacionByUuidOrFail(tipoEvaluacionUuid)
      : objetivo.tipoEvaluacion;
    if (tipoEvaluacionUuid) data.tipoEvaluacionId = tipoEvaluacion.id;

    if (payload.fincaUuid !== undefined || payload.loteUuid !== undefined) {
      const { fincaId, loteId, edadMinima, edadMaxima } = await resolverAmbitoYEdad(
        {
          fincaUuid: payload.fincaUuid,
          loteUuid: payload.loteUuid,
          edadMinima: payload.edadMinima,
          edadMaxima: payload.edadMaxima,
        },
        tipoEvaluacion,
      );
      data.fincaId = fincaId;
      data.loteId = loteId;
      data.edadMinima = edadMinima;
      data.edadMaxima = edadMaxima;
    } else if (payload.edadMinima !== undefined || payload.edadMaxima !== undefined) {
      const esConteoHojas = tipoEvaluacion.nombre === CONTEO_HOJAS_NOMBRE;
      data.edadMinima = esConteoHojas ? payload.edadMinima ?? null : null;
      data.edadMaxima = esConteoHojas ? payload.edadMaxima ?? null : null;
      if (data.edadMinima !== null && data.edadMaxima !== null && data.edadMinima > data.edadMaxima) {
        throw ApiError.badRequest('La edad mínima no puede ser mayor que la edad máxima');
      }
    }

    if (payload.cantidad !== undefined) data.cantidad = payload.cantidad;
    if (payload.estado !== undefined) data.estado = payload.estado;

    const resultante = {
      tipoEvaluacionId: data.tipoEvaluacionId ?? objetivo.tipoEvaluacionId,
      fincaId: data.fincaId !== undefined ? data.fincaId : objetivo.fincaId,
      loteId: data.loteId !== undefined ? data.loteId : objetivo.loteId,
      edadMinima: data.edadMinima !== undefined ? data.edadMinima : objetivo.edadMinima,
      edadMaxima: data.edadMaxima !== undefined ? data.edadMaxima : objetivo.edadMaxima,
    };
    await assertAmbitoPermitido(resultante.fincaId, resultante.loteId, user);
    if (data.estado ?? objetivo.estado) await assertSinDuplicado(resultante, objetivo.id);

    return objetivoEvaluacionRepository.update(objetivo, data);
  },

  async deleteObjetivo(uuid, actorId, user) {
    const objetivo = await this.getObjetivoByUuid(uuid);
    await assertAmbitoPermitido(objetivo.fincaId, objetivo.loteId, user);
    await objetivoEvaluacionRepository.softDelete(objetivo, actorId);
  },

  // Matriz de configuración: una fila por finca y una columna por tipo de evaluación. Cada celda trae el objetivo activo de ese tipo (o null);
  // los lotes se listan aparte como excepciones (vacío = hereda el de la finca). Si hay varios objetivos activos del mismo tipo y ámbito (rangos
  // de edad distintos) la celda es de solo lectura (`multiples`) y se edita desde la lista.
  async matriz(query, user) {
    const fincaIds = getFincaIdsPermitidas(user);
    const [tipos, fincas, objetivos] = await Promise.all([
      TipoEvaluacion.findAll({ where: { estado: true }, attributes: ['id', 'uuid', 'nombre'], order: [['nombre', 'ASC']] }),
      Finca.findAll({ where: { estado: true, ...(fincaIds ? { id: { [Op.in]: fincaIds } } : {}) }, attributes: ['id', 'uuid', 'codigo', 'nombre'], order: [['nombre', 'ASC']] }),
      objetivoEvaluacionRepository.findActivos({ fincaIds }),
    ]);
    const lotes = fincas.length
      ? await Lote.findAll({ where: { fincaId: { [Op.in]: fincas.map((f) => f.id) } }, attributes: ['id', 'uuid', 'codigo', 'nombre', 'fincaId'], order: [['nombre', 'ASC']] })
      : [];
    const celda = (lista) => {
      const celdas = {};
      for (const t of tipos) {
        const propios = lista.filter((o) => o.tipoEvaluacionId === t.id);
        celdas[t.uuid] = propios.length
          ? { uuid: propios[0].uuid, cantidad: propios[0].cantidad, edadMinima: propios[0].edadMinima, edadMaxima: propios[0].edadMaxima, multiples: propios.length > 1 }
          : null;
      }
      return celdas;
    };
    return {
      tipos: tipos.map((t) => ({ uuid: t.uuid, nombre: t.nombre, conEdades: t.nombre === CONTEO_HOJAS_NOMBRE })),
      fincas: fincas.map((f) => ({
        uuid: f.uuid,
        codigo: f.codigo,
        nombre: f.nombre,
        celdas: celda(objetivos.filter((o) => o.fincaId === f.id)),
        lotes: lotes
          .filter((l) => l.fincaId === f.id)
          .map((l) => ({ uuid: l.uuid, codigo: l.codigo, nombre: l.nombre, celdas: celda(objetivos.filter((o) => o.loteId === l.id)) })),
      })),
    };
  },

  // Guarda en una sola transacción las celdas cambiadas de la matriz. `cantidad` null = quitar el objetivo (borrado lógico).
  async guardarMatriz(body, actorId, user) {
    const celdas = body.celdas || [];
    if (celdas.length === 0) throw ApiError.badRequest('No hay cambios para guardar');
    const resumen = { creadas: 0, actualizadas: 0, quitadas: 0 };
    await sequelize.transaction(async (transaction) => {
      for (const c of celdas) {
        const tipo = await findTipoEvaluacionByUuidOrFail(c.tipoEvaluacionUuid);
        const { fincaId, loteId, edadMinima, edadMaxima } = await resolverAmbitoYEdad(c, tipo);
        await assertAmbitoPermitido(fincaId, loteId, user);
        const clave = { tipoEvaluacionId: tipo.id, fincaId, loteId };
        const activos = await objetivoEvaluacionRepository.findPorTipoYAmbito({ ...clave, soloActivos: true }, { transaction });
        if (activos.length > 1) throw ApiError.conflict(`Hay varios objetivos de «${tipo.nombre}» en este ámbito (rangos de edad distintos): edítalos desde la lista`);
        if (c.cantidad === null || c.cantidad === undefined) {
          if (activos.length) {
            await objetivoEvaluacionRepository.softDelete(activos[0], actorId, { transaction });
            resumen.quitadas += 1;
          }
          continue;
        }
        if (activos.length) {
          await objetivoEvaluacionRepository.update(activos[0], { cantidad: c.cantidad, edadMinima, edadMaxima, updatedBy: actorId }, { transaction });
          resumen.actualizadas += 1;
          continue;
        }
        // Sin activo: se reactiva uno inactivo del mismo ámbito (evita acumular filas) o se crea.
        const inactivos = await objetivoEvaluacionRepository.findPorTipoYAmbito(clave, { transaction });
        if (inactivos.length) {
          await objetivoEvaluacionRepository.update(inactivos[0], { cantidad: c.cantidad, edadMinima, edadMaxima, estado: true, updatedBy: actorId }, { transaction });
          resumen.actualizadas += 1;
        } else {
          await objetivoEvaluacionRepository.create({ ...clave, cantidad: c.cantidad, edadMinima, edadMaxima, estado: true, createdBy: actorId }, { transaction });
          resumen.creadas += 1;
        }
      }
    });
    return resumen;
  },

  // Cumplimiento de la semana: por cada finca con objetivos, los que no se cumplieron. Un objetivo de finca se cuenta con todas las
  // evaluaciones de la finca; uno de lote, solo con las de ese lote.
  async cumplimientoSemana(semana) {
    const objetivos = await objetivoEvaluacionRepository.findActivosConDetalle();
    const porFinca = new Map();
    for (const o of objetivos) {
      const finca = o.fincaId ? o.finca : o.lote?.finca;
      if (!finca) continue;
      if (!porFinca.has(finca.id)) porFinca.set(finca.id, { finca, objetivos: [] });
      porFinca.get(finca.id).objetivos.push(o);
    }
    const todas = [];
    for (const { finca, objetivos: lista } of porFinca.values()) {
      const evs = await evaluacionRepository.findAllPorSemana({ fincaIds: [finca.id], semanaId: semana.id });
      const faltantes = [];
      for (const o of lista) {
        const evsObjetivo = o.fincaId ? evs : evs.filter((ev) => ev.planta?.lote?.id === o.loteId);
        const { realizadas, faltan } = construirProgreso(evsObjetivo, o);
        if (faltan <= 0) continue;
        const meta = o.edadMinima !== null && o.edadMaxima !== null ? o.cantidad * (o.edadMaxima - o.edadMinima + 1) : o.cantidad;
        faltantes.push({ tipo: o.tipoEvaluacion?.nombre, ambito: o.fincaId ? 'Finca' : `Lote ${o.lote?.nombre}`, meta, realizadas, faltan });
      }
      todas.push({ fincaId: finca.id, finca: finca.nombre, faltantes });
    }
    todas.sort((a, b) => a.finca.localeCompare(b.finca, 'es'));
    return { todas };
  },

  // Destinatarios del correo con las fincas que cada uno puede ver: correos sueltos → todas; usuarios (por rol o elegidos uno a uno) → solo sus
  // fincas asignadas (con su grupo de fincas), y todas si son Administrador o no tienen ninguna asignada. Devuelve [{ email, fincaIds | null }].
  async destinatariosConAlcance() {
    const config = await configuracionService.getObjetivosDestinatarios();
    const porEmail = new Map(); // email -> fincaIds (null = todas)
    const sumar = (email, ids) => {
      const clave = String(email || '').trim().toLowerCase();
      if (!clave) return;
      if (!porEmail.has(clave)) porEmail.set(clave, ids === null ? null : new Set(ids));
      else {
        const actual = porEmail.get(clave);
        if (actual === null || ids === null) porEmail.set(clave, null);
        else ids.forEach((id) => actual.add(id));
      }
    };
    for (const c of config.correos || []) sumar(c, null);
    const uuids = (l) => (Array.isArray(l) ? l.map((x) => (typeof x === 'string' ? x : x?.uuid)).filter(Boolean) : []);
    const porRol = uuids(config.rolesUuids).length
      ? await User.findAll({ where: { estado: true }, include: [{ model: Role, as: 'roles', attributes: ['nombre'], where: { uuid: uuids(config.rolesUuids) }, through: { attributes: [] } }] })
      : [];
    const puntuales = uuids(config.usuariosUuids).length ? await User.findAll({ where: { estado: true, uuid: uuids(config.usuariosUuids) }, include: [{ model: Role, as: 'roles', attributes: ['nombre'], through: { attributes: [] } }] }) : [];
    for (const u of [...porRol, ...puntuales]) {
      const esAdmin = (u.roles || []).some((r) => r.nombre === ROLES.ADMINISTRADOR);
      const asignadas = esAdmin ? [] : await userRepository.findFincaIdsByUserId(u.id);
      sumar(u.email, esAdmin || asignadas.length === 0 ? null : await expandirFincaIds(asignadas));
    }
    return [...porEmail.entries()].map(([email, ids]) => ({ email, fincaIds: ids === null ? null : [...ids] }));
  },

  // Correo del domingo en la noche con las fincas que no cumplieron los objetivos de evaluación de la semana. Cada destinatario recibe solo
  // las fincas que tiene asignadas (todas si no tiene ninguna, es Administrador o es un correo suelto). Una sola vez por semana (queda anotado
  // en la configuración); `forzar` lo repite.
  async avisarIncumplimientoSemana({ forzar = false } = {}) {
    const hoy = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
    const semana = await semanaRepository.findByFecha(hoy);
    if (!semana) return { enviado: false };
    if (!forzar && (await configuracionService.getObjetivosIncumplidosAvisado()) === semana.codigo) return { enviado: false };
    const { todas } = await this.cumplimientoSemana(semana);
    const destinatarios = await this.destinatariosConAlcance();
    if (todas.length === 0 || destinatarios.length === 0) {
      logger.info('Objetivos de la semana: sin objetivos o sin destinatarios, no se envía', { semana: semana.codigo, fincas: todas.length, destinatarios: destinatarios.length });
      if (!forzar) await configuracionService.setObjetivosIncumplidosAvisado(semana.codigo);
      return { enviado: false };
    }
    let enviados = 0;
    let fallidos = 0;
    for (const d of destinatarios) {
      const suyas = d.fincaIds === null ? todas : todas.filter((f) => d.fincaIds.includes(f.fincaId));
      if (suyas.length === 0) continue; // no tiene objetivos en sus fincas
      const incumplidas = suyas.filter((f) => f.faltantes.length > 0);
      try {
        await mailService.sendObjetivosIncumplidos({
          destinatarios: [d.email],
          semana: semana.codigo,
          fincas: incumplidas.map((f) => ({ finca: f.finca, faltantes: f.faltantes })),
          cumplieron: suyas.length - incumplidas.length,
          total: suyas.length,
        });
        enviados += 1;
      } catch (error) {
        fallidos += 1;
        logger.error('No se pudo enviar el aviso de objetivos', { message: error.message });
      }
    }
    // Si algún envío falló no se anota la semana: el job lo reintenta en la siguiente revisión (los que ya llegaron se repetirían, y es raro).
    if (!forzar && !fallidos) await configuracionService.setObjetivosIncumplidosAvisado(semana.codigo);
    return { enviado: enviados > 0, enviados, fallidos };
  },

  // Progreso de los objetivos aplicables a una finca y/o un lote, para la
  // semana indicada (o la semana abierta actual si no llega ninguna) — lo
  // consulta la app móvil justo después de sincronizar.
  async progreso(query, user) {
    const finca = query.fincaUuid ? await findFincaByUuidOrFail(query.fincaUuid) : null;
    if (finca) assertFincaPermitida(user, finca.id);
    const lote = query.loteUuid ? await findLoteByUuidOrFail(query.loteUuid) : null;
    if (lote) assertFincaPermitida(user, lote.fincaId);

    const semana = query.semanaUuid
      ? await Semana.findOne({ where: { uuid: query.semanaUuid } })
      : await semanaRepository.findByFecha(new Date().toISOString().slice(0, 10));
    if (!semana) return { semana: null, objetivos: [] };

    const objetivos = aplicarPrecedencia(
      await objetivoEvaluacionRepository.findAplicables({
        fincaId: finca?.id,
        loteId: lote?.id,
      }),
    );
    if (objetivos.length === 0) {
      return {
        semana: { uuid: semana.uuid, codigo: semana.codigo, numeroSemana: semana.numeroSemana, anio: semana.anio },
        objetivos: [],
      };
    }

    const necesitaFinca = objetivos.some((o) => o.fincaId);
    const necesitaLote = objetivos.some((o) => o.loteId);

    const evsFinca = necesitaFinca
      ? await evaluacionRepository.findAllPorSemana({ fincaIds: [finca.id], semanaId: semana.id })
      : [];
    const evsLote = necesitaLote
      ? await evaluacionRepository.findAllPorSemana({ loteId: lote.id, semanaId: semana.id })
      : [];

    const resultado = objetivos.map((o) => {
      const { realizadas, faltan, detalleEdades } = construirProgreso(o.fincaId ? evsFinca : evsLote, o);
      return {
        uuid: o.uuid,
        tipoNombre: o.tipoEvaluacion?.nombre,
        alcance: o.fincaId ? 'finca' : 'lote',
        nombreAmbito: o.fincaId ? o.finca?.nombre : o.lote?.nombre,
        cantidad: o.cantidad,
        edadMinima: o.edadMinima,
        edadMaxima: o.edadMaxima,
        realizadas,
        faltan,
        detalleEdades,
      };
    });

    return {
      semana: { uuid: semana.uuid, codigo: semana.codigo, numeroSemana: semana.numeroSemana, anio: semana.anio },
      objetivos: resultado,
    };
  },
};

export default objetivoEvaluacionService;
