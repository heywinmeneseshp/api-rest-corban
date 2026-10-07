import { Op, literal } from 'sequelize';
import { sequelize } from '../../database/connection.js';
import { Finca, Role, Lote, User, LoteAreaProduccion, LoteAreaOmitido, LoteAreaSolicitud } from '../../database/associations.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { loteAreaConfigRepository } from '../../repositories/agricola/loteAreaConfig.repository.js';
import { loteRepository } from '../../repositories/agricola/lote.repository.js';
import { semanaRepository } from '../../repositories/agricola/semana.repository.js';
import { loteService } from './lote.service.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { getFincaIdsPermitidas } from '../../utils/fincaScope.js';

// Zona horaria del negocio, no la del servidor — mismo criterio (y mismo
// motivo: Vercel corre en UTC) que precipitacionDiaria.service.js.
const ZONA_NEGOCIO = 'America/Bogota';
const hoyIso = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_NEGOCIO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(),
  );

// Días que avanza la fecha objetivo al cumplirse una campaña, por
// recurrencia (ver migración 20261112000000).
const DIAS_RECURRENCIA = { SEMANAL: 7, QUINCENAL: 15, MENSUAL: 30 };

// Suma días a una fecha DATEONLY ('YYYY-MM-DD') sin que el huso horario
// corra el día (mismo truco que diasEntre en el frontend de precalibración).
const sumarDias = (fechaIso, dias) => {
  const d = new Date(`${fechaIso}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
};

const findFincaByUuidOrFail = async (uuid) => {
  const finca = await Finca.findOne({ where: { uuid } });
  if (!finca) throw ApiError.notFound('Finca no encontrada');
  return finca;
};

// Fincas con config activa relevante para el usuario — mismo criterio que
// getPendientes. Cada finca es independiente (no se expande por Grupo de
// Finca: los lotes de una finca no se mezclan con los de otra). null = sin
// restricción.
const fincaIdsConConfigRelevante = async (user) => {
  const roles = user?.roles || [];
  if (roles.length === 0) return [];
  const configs = await loteAreaConfigRepository.findActivas();
  const fincaIdsPermitidas = getFincaIdsPermitidas(user);
  const hoy = hoyIso();
  const ids = configs
    .filter(
      (c) =>
        roles.includes(c.rol?.nombre) &&
        (fincaIdsPermitidas === null || fincaIdsPermitidas.includes(c.fincaId)) &&
        c.fechaObjetivo <= hoy,
    )
    .map((c) => c.fincaId);
  if (fincaIdsPermitidas === null) return null;
  return [...new Set(ids)];
};

// Config relevante (la de fechaObjetivo más reciente) que cubre una finca,
// o null si ninguna la cubre — mismo criterio que getPendientes.
const configRelevanteParaFinca = async (user, fincaId) => {
  const roles = user?.roles || [];
  if (roles.length === 0) return null;
  const configs = await loteAreaConfigRepository.findActivas();
  const fincaIdsPermitidas = getFincaIdsPermitidas(user);
  const hoy = hoyIso();
  const relevantes = configs.filter(
    (c) =>
      roles.includes(c.rol?.nombre) &&
      (fincaIdsPermitidas === null || fincaIdsPermitidas.includes(c.fincaId)) &&
      c.fechaObjetivo <= hoy,
  );
  const porFinca = new Map();
  for (const c of relevantes) {
    const actual = porFinca.get(c.fincaId);
    if (!actual || c.fechaObjetivo > actual.fechaObjetivo) porFinca.set(c.fincaId, c);
  }
  // Solo la config de ESA finca (los lotes de cada finca son independientes).
  return porFinca.get(fincaId) || null;
};

export const loteAreaConfigService = {
  // ─── Configuración (admin) ───

  async crearConfig({ fincaUuid, rolId, fechaObjetivo, recurrencia }, actorId) {
    const finca = await findFincaByUuidOrFail(fincaUuid);
    const rol = await Role.findByPk(rolId);
    if (!rol) throw ApiError.notFound('Rol no encontrado');

    // Upsert por (finca, rol): si ya hay una config (activa o no, sin
    // borrar), se actualiza su fecha (y recurrencia) en vez de crear una
    // fila duplicada.
    const existente = await loteAreaConfigRepository.findByFincaYRol(finca.id, rol.id);
    if (existente) {
      return {
        config: await loteAreaConfigRepository.update(
          existente,
          {
            fechaObjetivo,
            recurrencia: recurrencia ?? existente.recurrencia ?? 'UNA_VEZ',
            activo: true,
            updatedBy: actorId,
          },
        ),
        creada: false,
      };
    }

    const config = await loteAreaConfigRepository.create({
      fincaId: finca.id,
      rolId: rol.id,
      fechaObjetivo,
      recurrencia: recurrencia ?? 'UNA_VEZ',
      createdBy: actorId,
    });
    return { config, creada: true };
  },

  async listConfig(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await loteAreaConfigRepository.findAndCountAll({ limit, offset });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async toggleConfig(uuid, activo, actorId) {
    const config = await loteAreaConfigRepository.findByUuid(uuid);
    if (!config) throw ApiError.notFound('Configuración no encontrada');
    return loteAreaConfigRepository.update(config, { activo, updatedBy: actorId });
  },

  async eliminarConfig(uuid, actorId) {
    const config = await loteAreaConfigRepository.findByUuid(uuid);
    if (!config) throw ApiError.notFound('Configuración no encontrada');
    await loteAreaConfigRepository.softDelete(config, actorId);
  },

  // ─── Pendientes (usado por el modal bloqueante) ───
  //
  // Configs activas cuyo rol coincide con alguno de los del usuario, cuya
  // finca esté dentro de las que puede ver, y cuya fechaObjetivo ya llegó
  // (hoy o antes). A diferencia de Precipitación Diaria (que exige ponerse
  // al día con CADA día faltante desde una fecha de inicio), acá es un
  // evento puntual: si hay varias configs vencidas para la misma finca, se
  // usa la de fechaObjetivo más reciente. Cada finca es INDEPENDIENTE: solo
  // se piden (y se ocultan) los lotes de la propia finca, aunque pertenezca a
  // un Grupo de Finca.
  async getPendientes(user) {
    const roles = user?.roles || [];
    if (roles.length === 0) return [];

    const configs = await loteAreaConfigRepository.findActivas();
    if (configs.length === 0) return [];

    const fincaIdsPermitidas = getFincaIdsPermitidas(user); // null = sin restricción
    const hoy = hoyIso();

    const relevantes = configs.filter(
      (c) =>
        roles.includes(c.rol?.nombre) &&
        (fincaIdsPermitidas === null || fincaIdsPermitidas.includes(c.fincaId)) &&
        c.fechaObjetivo <= hoy,
    );
    if (relevantes.length === 0) return [];

    const porFinca = new Map();
    for (const c of relevantes) {
      const actual = porFinca.get(c.fincaId);
      if (!actual || c.fechaObjetivo > actual.fechaObjetivo) porFinca.set(c.fincaId, c);
    }

    const pendientesPorFinca = [];
    for (const config of porFinca.values()) {
      // Solo los lotes de la propia finca de la config: cada finca es independiente
      // (aunque pertenezca a un Grupo de Finca, sus lotes no se mezclan con los de otra).
      const fincaIds = [config.fincaId];
      // Mismo orden natural por nombre (1, 2, 3, ... 10, 11) que el resto de
      // listados de lotes, con `codigo` como desempate estable.
      const lotes = await Lote.findAll({
        where: { fincaId: { [Op.in]: fincaIds }, estado: true },
        order: [[literal('CAST(`Lote`.`nombre` AS UNSIGNED)'), 'ASC'], ['codigo', 'ASC']],
      });
      if (lotes.length === 0) continue;

      const loteIds = lotes.map((l) => l.id);
      const cumplidos = await LoteAreaProduccion.findAll({
        where: {
          loteId: { [Op.in]: loteIds },
          fechaRegistro: { [Op.gte]: config.fechaObjetivo },
          areaTotal: { [Op.ne]: null },
        },
      });
      const loteIdsCumplidos = new Set(cumplidos.map((c) => c.loteId));
      // Enviados y a la espera de aprobación: ya no se le piden de nuevo al
      // usuario (si se rechazan, el lote vuelve a quedar pendiente).
      const enAprobacion = await LoteAreaSolicitud.findAll({
        where: {
          loteId: { [Op.in]: loteIds },
          estado: 'PENDIENTE',
          fechaSolicitud: { [Op.gte]: config.fechaObjetivo },
        },
        attributes: ['loteId'],
      });
      for (const sol of enAprobacion) loteIdsCumplidos.add(sol.loteId);
      // Ocultados de esta campaña (finca + fecha_objetivo): no se borran,
      // solo dejan de verse en el modal — estadísticas, informes y Maestros
      // los siguen leyendo normal.
      const omitidos = await LoteAreaOmitido.findAll({
        where: { loteId: { [Op.in]: loteIds }, fechaObjetivo: config.fechaObjetivo },
        attributes: ['loteId'],
      });
      const loteIdsOmitidos = new Set(omitidos.map((o) => o.loteId));
      const lotesPendientes = lotes.filter((l) => !loteIdsCumplidos.has(l.id) && !loteIdsOmitidos.has(l.id));

      // Campaña cumplida (todo confirmado u ocultado): se resuelve sola para
      // no dejar configs viejas activas. UNA_VEZ se desactiva; con
      // recurrencia la fecha objetivo avanza (poniéndose al día si se
      // atrasó varias veces) hasta quedar futura.
      if (lotesPendientes.length === 0) {
        const recurrencia = config.recurrencia || 'UNA_VEZ';
        const dias = DIAS_RECURRENCIA[recurrencia];
        if (!dias) {
          await loteAreaConfigRepository.update(config, { activo: false, updatedBy: user?.id ?? null });
        } else {
          let siguiente = config.fechaObjetivo;
          for (let i = 0; i < 520 && siguiente <= hoy; i++) {
            siguiente = sumarDias(siguiente, dias);
          }
          await loteAreaConfigRepository.update(config, { fechaObjetivo: siguiente, updatedBy: user?.id ?? null });
        }
        continue;
      }

      pendientesPorFinca.push({
        fincaUuid: config.finca.uuid,
        fincaNombre: config.finca.nombre,
        fechaObjetivo: config.fechaObjetivo,
        lotes: lotesPendientes.map((l) => ({ uuid: l.uuid, nombre: l.nombre, codigo: l.codigo, areaActual: l.area })),
      });
    }

    return pendientesPorFinca;
  },

  // ─── Registro (desde el modal bloqueante) ───
  //
  // Sin chequeo de permiso más allá de `auth` (ver routes): el modal solo
  // puede enviar lo que el propio getPendientes le mostró, y exigir un
  // permiso amplio de edición de lotes bloquearía al rol designado si no lo
  // tiene. Mismo criterio que precipitacionDiariaService.registrar.
  // Con area_lote.aprobar (o Administrador) el cambio se aplica directo; sin
  // él queda como solicitud PENDIENTE de aprobación.
  async registrarLotes(registros, actorId, user) {
    if (!Array.isArray(registros) || registros.length === 0) {
      throw ApiError.badRequest('Debes enviar al menos un registro');
    }
    const hoy = hoyIso();
    const semanaHoy = await semanaRepository.findByFecha(hoy);
    const aplicaDirecto = (user?.permissions || []).includes(PERMISSIONS.AREA_LOTE_APROBAR);

    return sequelize.transaction(async (transaction) => {
      const resultados = [];
      for (const r of registros) {
        if (!r.loteUuid || r.areaTotal === undefined || r.areaProduccion === undefined) {
          throw ApiError.badRequest('Cada registro requiere loteUuid, areaTotal y areaProduccion');
        }
        const lote = await Lote.findOne({ where: { uuid: r.loteUuid }, transaction });
        if (!lote) throw ApiError.notFound(`Lote no encontrado: ${r.loteUuid}`);

        if (!aplicaDirecto) {
          // Una sola solicitud pendiente por lote: reenviar la reemplaza.
          const existente = await LoteAreaSolicitud.findOne({ where: { loteId: lote.id, estado: 'PENDIENTE' }, transaction });
          const datos = {
            areaTotal: r.areaTotal,
            areaProduccion: r.areaProduccion,
            fechaSolicitud: hoy,
            solicitadoPor: actorId,
          };
          if (existente) await existente.update(datos, { transaction });
          else await LoteAreaSolicitud.create({ loteId: lote.id, fincaId: lote.fincaId, ...datos }, { transaction });
          resultados.push({ loteUuid: lote.uuid, areaTotal: r.areaTotal, areaProduccion: r.areaProduccion, pendienteAprobacion: true });
          continue;
        }

        await LoteAreaProduccion.create(
          {
            loteId: lote.id,
            area: r.areaProduccion,
            areaTotal: r.areaTotal,
            fechaRegistro: hoy,
            semanaId: semanaHoy ? semanaHoy.id : null,
            createdBy: actorId,
          },
          { transaction },
        );
        await lote.update({ area: r.areaTotal, updatedBy: actorId }, { transaction });
        resultados.push({ loteUuid: lote.uuid, areaTotal: r.areaTotal, areaProduccion: r.areaProduccion, pendienteAprobacion: false });
      }
      return resultados;
    });
  },

  // ─── Aprobación de solicitudes (area_lote.aprobar) ───

  async listSolicitudes({ estado = 'PENDIENTE' } = {}) {
    const rows = await LoteAreaSolicitud.findAll({
      where: estado === 'TODAS' ? {} : { estado },
      include: [
        { model: Lote, as: 'lote', attributes: ['uuid', 'nombre', 'codigo', 'area'] },
        { model: Finca, as: 'finca', attributes: ['uuid', 'codigo', 'nombre'] },
        { model: User, as: 'solicitante', attributes: ['uuid', 'usuario'] },
        { model: User, as: 'resolutor', attributes: ['uuid', 'usuario'] },
      ],
      order: [['createdAt', 'DESC']],
      limit: 300,
    });
    return rows.map((r) => ({
      uuid: r.uuid,
      estado: r.estado,
      fechaSolicitud: r.fechaSolicitud,
      areaTotal: Number(r.areaTotal),
      areaProduccion: Number(r.areaProduccion),
      areaActual: r.lote?.area !== null && r.lote?.area !== undefined ? Number(r.lote.area) : null,
      lote: r.lote ? { uuid: r.lote.uuid, nombre: r.lote.nombre, codigo: r.lote.codigo } : null,
      finca: r.finca ? { uuid: r.finca.uuid, nombre: r.finca.nombre } : null,
      solicitante: r.solicitante?.usuario || null,
      resolutor: r.resolutor?.usuario || null,
      resueltoAt: r.resueltoAt,
      motivoRechazo: r.motivoRechazo,
    }));
  },

  async aprobarSolicitud(uuid, actorId) {
    const hoy = hoyIso();
    return sequelize.transaction(async (transaction) => {
      const sol = await LoteAreaSolicitud.findOne({ where: { uuid }, transaction });
      if (!sol) throw ApiError.notFound('Solicitud no encontrada');
      if (sol.estado !== 'PENDIENTE') throw ApiError.conflict('La solicitud ya fue resuelta');
      const lote = await Lote.findByPk(sol.loteId, { transaction });
      if (!lote) throw ApiError.notFound('Lote no encontrado');

      // fechaRegistro = la de la solicitud, para que cuente en la campaña
      // en la que se pidió (>= fechaObjetivo).
      await LoteAreaProduccion.create(
        {
          loteId: lote.id,
          area: sol.areaProduccion,
          areaTotal: sol.areaTotal,
          fechaRegistro: sol.fechaSolicitud || hoy,
          semanaId: (await semanaRepository.findByFecha(sol.fechaSolicitud || hoy))?.id ?? null,
          createdBy: sol.solicitadoPor ?? actorId,
        },
        { transaction },
      );
      await lote.update({ area: sol.areaTotal, updatedBy: actorId }, { transaction });
      await sol.update({ estado: 'APROBADA', resueltoPor: actorId, resueltoAt: new Date() }, { transaction });
      return { uuid: sol.uuid, estado: sol.estado };
    });
  },

  async rechazarSolicitud(uuid, motivo, actorId) {
    const sol = await LoteAreaSolicitud.findOne({ where: { uuid } });
    if (!sol) throw ApiError.notFound('Solicitud no encontrada');
    if (sol.estado !== 'PENDIENTE') throw ApiError.conflict('La solicitud ya fue resuelta');
    await sol.update({
      estado: 'RECHAZADA',
      resueltoPor: actorId,
      resueltoAt: new Date(),
      motivoRechazo: motivo ? String(motivo).slice(0, 300) : null,
    });
    return { uuid: sol.uuid, estado: sol.estado };
  },

  // ─── Ocultar lote del pendiente (con permiso configurable) ───
  //
  // Quita el lote de la vista del modal SIN borrarlo: no hay protecciones
  // por registros asociados porque nada se elimina — estadísticas, informes
  // y Maestros lo siguen leyendo normal. La omisión es por campaña (finca +
  // fecha_objetivo de la config que lo cubre): en una campaña nueva vuelve a
  // aparecer. Idempotente: ocultar dos veces no falla.
  async eliminarLotePendiente(loteUuid, actorId, user) {
    const lote = await loteRepository.findByUuid(loteUuid);
    if (!lote) throw ApiError.notFound('Lote no encontrado');

    const config = await configRelevanteParaFinca(user, lote.fincaId);
    if (!config) {
      throw ApiError.forbidden('El lote no está dentro de tus pendientes de área');
    }

    await LoteAreaOmitido.findOrCreate({
      where: { loteId: lote.id, fechaObjetivo: config.fechaObjetivo },
      defaults: { fincaId: lote.fincaId, createdBy: actorId },
    });
  },

  // ─── Agregar lote desde el modal (con permiso configurable) ───
  //
  // Crea el lote en la finca del pendiente (mismas validaciones que
  // lote.service.createLote: nombre numérico único y código auto) para que
  // aparezca en la lista y se le registre el área ahí mismo. El área nace
  // vacía: se diligencia en el modal como los demás.
  async agregarLotePendiente({ fincaUuid, nombre }, actorId, user) {
    const finca = await findFincaByUuidOrFail(fincaUuid);

    const fincaIds = await fincaIdsConConfigRelevante(user);
    if (fincaIds !== null && !fincaIds.includes(finca.id)) {
      throw ApiError.forbidden('La finca no está dentro de tus pendientes de área');
    }

    const nombreLimpio = String(nombre ?? '').trim();
    if (!/^\d+$/.test(nombreLimpio)) {
      throw ApiError.badRequest('El nombre del lote debe contener solo números (ej: 01, 02).');
    }
    const duplicado = await loteRepository.findByFincaAndNombre(finca.id, nombreLimpio);
    if (duplicado) {
      // Si ese lote existe pero estaba oculto de esta campaña, agregarlo lo
      // vuelve a mostrar en vez de fallar.
      const config = await configRelevanteParaFinca(user, finca.id);
      const reactivados = config
        ? await LoteAreaOmitido.destroy({ where: { loteId: duplicado.id, fechaObjetivo: config.fechaObjetivo } })
        : 0;
      if (reactivados > 0) {
        return { uuid: duplicado.uuid, nombre: duplicado.nombre, codigo: duplicado.codigo, areaActual: duplicado.area };
      }
      throw ApiError.conflict('Ya existe un lote con ese nombre en esta finca');
    }

    const codigo = await loteService.generateCodigo(finca, nombreLimpio);
    const existente = await loteRepository.findByFincaAndCodigo(finca.id, codigo);
    if (existente) throw ApiError.conflict('Ya existe un lote con ese código en esta finca');

    const lote = await loteRepository.create({
      fincaId: finca.id,
      codigo,
      nombre: nombreLimpio,
      area: null,
      estado: true,
      createdBy: actorId,
    });

    return { uuid: lote.uuid, nombre: lote.nombre, codigo: lote.codigo, areaActual: null };
  },
};

export default loteAreaConfigService;
