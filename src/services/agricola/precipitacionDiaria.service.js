import crypto from 'crypto';
import { Op } from 'sequelize';
import { sequelize } from '../../database/connection.js';
import { Finca, Role, Semana, User, PrecipitacionDiariaConfig, PrecipitacionDiaria } from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';
import { getFincaIdsPermitidas, expandirFincaUuids } from '../../utils/fincaScope.js';
import { climaService } from './clima.service.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';

// Dos tablas, separadas del "clima" que registra la app móvil:
// - precipitacion_diaria_config: qué rol debe capturar la precipitación de
//   qué finca, a partir de qué semana (programado por un admin).
// - precipitacion_diaria: el registro día a día en sí, capturado desde
//   app-corbana. No se mezcla con la tabla `clima` (que trae mm/temperatura/
//   humedad por visita de la app móvil, con otra granularidad) — acá es un
//   registro de cumplimiento diario obligatorio por finca.
// Ambas se crearon originalmente con SQL crudo (CREATE TABLE IF NOT EXISTS
// en cada arranque) y sin llaves foráneas — ver migración
// 20260821000003-fk-precipitacion-diaria y los modelos
// precipitacionDiaria(Config).model.js para las relaciones reales que se
// les agregaron después. Los nombres se siguen guardando denormalizados
// (finca_nombre/rol_nombre/usuario_nombre/etc.) como respaldo — las
// lecturas de abajo prefieren el dato vivo de la relación cuando existe.

// Compara el mm de un registro de precipitacion_diaria contra el `clima` de
// la misma finca+fecha. No existe fila en clima, o el mm no coincide → false;
// mm igual (comparado como número, no como string) → true. Nunca escribe en
// `clima` — las dos tablas siguen siendo independientes, esto solo lee.
const calcularCoincide = async (fincaUuid, fecha, mm) => {
  const registroClima = await climaService.getByFincaFecha(fincaUuid, fecha);
  if (!registroClima || registroClima.mm === null) return false; // sin dato real en clima aún
  return Number(registroClima.mm) === Number(mm);
};

// Zona horaria del negocio, no la del servidor — en local el servidor corre
// en hora Colombia (por eso "andaba bien" ahí), pero en producción (Vercel)
// corre en UTC. Confiar en la hora local del proceso (getDate()/getFullYear())
// se rompe justo de noche en Colombia, cuando UTC ya cruzó la medianoche y el
// servidor cree que es un día después. Fijar la zona explícitamente hace que
// "hoy"/"ayer" den lo mismo sin importar dónde esté físicamente desplegado.
const ZONA_NEGOCIO = 'America/Bogota';

const formatearFechaEnZona = (fecha) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_NEGOCIO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fecha);

const hoyIso = () => formatearFechaEnZona(new Date());

const ayerIso = () => {
  // Colombia no tiene horario de verano (UTC-5 todo el año), así que restar
  // 24hs exactas a "ahora" y volver a formatear en la misma zona siempre da
  // el día calendario anterior, sin casos borde.
  const haceUnDia = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return formatearFechaEnZona(haceUnDia);
};

// Todas las fechas entre desde/hasta (inclusive), como strings YYYY-MM-DD.
const rangoFechas = (desdeIso, hastaIso) => {
  const fechas = [];
  const cursor = new Date(`${desdeIso}T00:00:00Z`);
  const fin = new Date(`${hastaIso}T00:00:00Z`);
  while (cursor <= fin) {
    fechas.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return fechas;
};

const fechaAIso = (fecha) => (fecha instanceof Date ? fecha.toISOString().slice(0, 10) : String(fecha));

// Forma que ya esperaba el frontend (snake_case, viene de cuando esto era
// SQL crudo con `SELECT *`) — se arma a mano acá para no tener que tocar
// app-corbana al pasar a modelos Sequelize.
const serializarConfig = (c) => ({
  uuid: c.uuid,
  finca_uuid: c.fincaUuid,
  finca_nombre: c.finca?.nombre ?? c.fincaNombre,
  rol_nombre: c.rol?.nombre ?? c.rolNombre,
  semana_inicio_codigo: c.semanaInicio?.codigo ?? c.semanaInicioCodigo,
  fecha_inicio: fechaAIso(c.fechaInicio),
  activo: c.activo,
});

const serializarRegistro = (r) => ({
  uuid: r.uuid,
  finca_uuid: r.fincaUuid,
  finca_nombre: r.finca?.nombre ?? r.fincaNombre,
  fecha: fechaAIso(r.fecha),
  mm: Number(r.mm),
  usuario_id: r.usuarioId,
  // usuario.usuario = el nombre de login, mismo dato que ya se mostraba acá
  // antes (usuario_nombre) — vivo vía la relación en vez de congelado al
  // registrar, con la copia como respaldo para filas sin usuario_id.
  usuario_nombre: r.usuario?.usuario ?? r.usuarioNombre,
  coincide_clima: r.coincideClima,
});

export const precipitacionDiariaService = {
  // ─── Configuración (admin) ───

  async crearConfig({ fincaUuid, rolId, semanaInicioUuid }, actorNombre) {
    const [finca, rol, semana] = await Promise.all([
      Finca.findOne({ where: { uuid: fincaUuid } }),
      Role.findByPk(rolId),
      Semana.findOne({ where: { uuid: semanaInicioUuid } }),
    ]);
    if (!finca) throw ApiError.notFound('Finca no encontrada');
    if (!rol) throw ApiError.notFound('Rol no encontrado');
    if (!semana) throw ApiError.notFound('Semana no encontrada');

    const config = await PrecipitacionDiariaConfig.create({
      uuid: crypto.randomUUID(),
      fincaId: finca.id,
      fincaUuid: finca.uuid,
      fincaNombre: finca.nombre,
      rolId: rol.id,
      rolNombre: rol.nombre,
      semanaInicioUuid: semana.uuid,
      semanaInicioCodigo: semana.codigo,
      fechaInicio: semana.fechaInicio,
      activo: true,
      creadoPorNombre: actorNombre || null,
    });

    return { uuid: config.uuid };
  },

  async listConfig() {
    const configs = await PrecipitacionDiariaConfig.findAll({
      include: [
        { model: Finca, as: 'finca', attributes: ['nombre'] },
        { model: Role, as: 'rol', attributes: ['nombre'] },
        { model: Semana, as: 'semanaInicio', attributes: ['codigo'] },
      ],
      order: [['created_at', 'DESC']],
    });
    return configs.map(serializarConfig);
  },

  async toggleConfig(uuid, activo) {
    const [affected] = await PrecipitacionDiariaConfig.update({ activo: !!activo }, { where: { uuid } });
    if (!affected) throw ApiError.notFound('Configuración no encontrada');
  },

  async eliminarConfig(uuid) {
    await PrecipitacionDiariaConfig.destroy({ where: { uuid } });
  },

  // ─── Registro diario ───

  async registrar(registros, actorId, actorNombre, user) {
    if (!Array.isArray(registros) || registros.length === 0) {
      throw ApiError.badRequest('Debes enviar al menos un registro');
    }

    // Si el rol del que registra tiene este permiso, cada registro también
    // se copia a `clima` (siempre, pise lo que haya o no — ver
    // PERMISSIONS.PRECIPITACION_DIARIA_PROPAGAR_CLIMA). El camino inverso
    // (Clima → Precipitación Diaria) nunca ocurre acá.
    const propagarAClima = (user?.permissions || []).includes(PERMISSIONS.PRECIPITACION_DIARIA_PROPAGAR_CLIMA);

    // Resuelve cada finca una sola vez aunque el lote traiga varias fechas
    // de la misma finca.
    const fincasCache = new Map();
    const resolverFinca = async (fincaUuid) => {
      if (fincasCache.has(fincaUuid)) return fincasCache.get(fincaUuid);
      const finca = await Finca.findOne({ where: { uuid: fincaUuid } });
      if (!finca) throw ApiError.notFound(`Finca no encontrada: ${fincaUuid}`);
      fincasCache.set(fincaUuid, finca);
      return finca;
    };

    // Resuelve la semana de cada fecha una sola vez (usada solo si hay que
    // propagar a `clima`, que exige semanaUuid).
    const semanasCache = new Map();
    const resolverSemana = async (fecha) => {
      if (semanasCache.has(fecha)) return semanasCache.get(fecha);
      const semana = await Semana.findOne({
        where: { fechaInicio: { [Op.lte]: fecha }, fechaFin: { [Op.gte]: fecha } },
      });
      semanasCache.set(fecha, semana);
      return semana;
    };

    const resultados = [];
    for (const r of registros) {
      if (!r.fincaUuid || !r.fecha || r.mm === undefined || r.mm === null) {
        throw ApiError.badRequest('Cada registro requiere fincaUuid, fecha y mm');
      }
      const finca = await resolverFinca(r.fincaUuid);

      let coincide;
      if (propagarAClima) {
        const semana = await resolverSemana(r.fecha);
        if (semana) {
          await climaService.create(
            {
              fincaUuid: finca.uuid,
              fincaNombre: finca.nombre,
              semanaUuid: semana.uuid,
              semanaCodigo: semana.codigo,
              fecha: r.fecha,
              mm: r.mm,
              usuarioNombre: actorNombre,
            },
            actorId,
          );
        }
        coincide = true; // se acaba de forzar el mismo mm en ambas tablas.
      } else {
        coincide = await calcularCoincide(finca.uuid, r.fecha, r.mm);
      }

      // No se usa Model.upsert(): por defecto sobreescribe TODAS las
      // columnas en conflicto, incluida `uuid` (regeneraría el uuid de un
      // registro ya existente en cada reenvío del mismo día) — se busca
      // primero por el único (finca_id, fecha) y se actualiza sin tocar el
      // uuid, o se crea uno nuevo si no existía.
      const existente = await PrecipitacionDiaria.findOne({ where: { fincaId: finca.id, fecha: r.fecha } });
      if (existente) {
        await existente.update({
          mm: r.mm,
          usuarioId: actorId || null,
          usuarioNombre: actorNombre || null,
          coincideClima: coincide,
        });
      } else {
        await PrecipitacionDiaria.create({
          uuid: crypto.randomUUID(),
          fincaId: finca.id,
          fincaUuid: finca.uuid,
          fincaNombre: finca.nombre,
          fecha: r.fecha,
          mm: r.mm,
          usuarioId: actorId || null,
          usuarioNombre: actorNombre || null,
          coincideClima: coincide,
        });
      }
      resultados.push({ fincaUuid: finca.uuid, fecha: r.fecha, mm: r.mm, coincideClima: coincide });
    }

    return resultados;
  },

  async list(query) {
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 50));
    const offset = (page - 1) * limit;

    const where = {};
    if (query.fincaUuid) {
      // Se expande a las fincas hermanas de su Grupo de Finca (ver
      // utils/fincaScope.js), si tiene uno asignado.
      where.fincaUuid = { [Op.in]: await expandirFincaUuids([query.fincaUuid]) };
    }
    if (query.fechaDesde || query.fechaHasta) {
      where.fecha = {};
      if (query.fechaDesde) where.fecha[Op.gte] = query.fechaDesde;
      if (query.fechaHasta) where.fecha[Op.lte] = query.fechaHasta;
    }
    if (query.usuarioId) where.usuarioId = query.usuarioId;

    const { rows, count } = await PrecipitacionDiaria.findAndCountAll({
      where,
      include: [
        { model: Finca, as: 'finca', attributes: ['nombre'] },
        { model: User, as: 'usuario', attributes: ['usuario'] },
      ],
      order: [['fecha', 'DESC']],
      limit,
      offset,
    });

    return { items: rows.map(serializarRegistro), meta: { page, limit, total: count } };
  },

  // Solo para poblar el filtro "Usuario" del reporte — nombre nada más, sin
  // exponer email/roles/fincas del listado general de /users. Se limita a
  // quienes ya registraron algo acá, no toda la base de usuarios.
  async listUsuariosRegistrados() {
    const registros = await PrecipitacionDiaria.findAll({
      where: { usuarioId: { [Op.ne]: null } },
      include: [{ model: User, as: 'usuario', attributes: ['usuario'] }],
      attributes: ['usuarioId'],
      group: ['usuarioId', 'usuario.id'],
      order: [[{ model: User, as: 'usuario' }, 'usuario', 'ASC']],
    });
    return registros.map((r) => ({ id: r.usuarioId, nombre: r.usuario?.usuario }));
  },

  // ─── Pendientes (usado por el modal bloqueante al iniciar sesión) ───
  //
  // Para el usuario logueado: junta las config activas cuyo rol coincide con
  // alguno de sus roles y cuya finca esté dentro de las que puede ver, y
  // calcula qué días entre fecha_inicio y ayer todavía no tienen registro.
  async getPendientes(user) {
    const roles = user?.roles || [];
    if (roles.length === 0) return [];

    const configs = await PrecipitacionDiariaConfig.findAll({
      where: { activo: true, rolNombre: { [Op.in]: roles } },
      raw: true,
    });
    if (configs.length === 0) return [];

    const fincaIdsPermitidas = getFincaIdsPermitidas(user); // null = sin restricción
    const hoy = hoyIso();
    const ayer = ayerIso();

    // Una finca puede tener más de una config activa (ej. dos roles
    // distintos) — se combinan las fechas faltantes en un solo bloque por
    // finca, usando la fecha_inicio más antigua entre las que apliquen.
    const porFinca = new Map();
    for (const c of configs) {
      if (fincaIdsPermitidas !== null && !fincaIdsPermitidas.includes(c.fincaId)) continue;
      const fechaInicio = fechaAIso(c.fechaInicio);
      if (fechaInicio > ayer) continue; // todavía no arrancó o arranca hoy/futuro

      const actual = porFinca.get(c.fincaUuid);
      if (!actual || fechaInicio < actual.fechaInicio) {
        porFinca.set(c.fincaUuid, { fincaUuid: c.fincaUuid, fincaNombre: c.fincaNombre, fechaInicio });
      }
    }
    if (porFinca.size === 0) return [];

    const pendientesPorFinca = [];
    for (const { fincaUuid, fincaNombre, fechaInicio } of porFinca.values()) {
      const registrados = await PrecipitacionDiaria.findAll({
        where: { fincaUuid, fecha: { [Op.between]: [fechaInicio, ayer] } },
        attributes: ['fecha'],
        raw: true,
      });
      const registradasSet = new Set(registrados.map((r) => fechaAIso(r.fecha)));

      const fechas = rangoFechas(fechaInicio, ayer).filter((f) => f !== hoy && !registradasSet.has(f));
      if (fechas.length > 0) {
        pendientesPorFinca.push({ fincaUuid, fincaNombre, fechas });
      }
    }

    return pendientesPorFinca;
  },

  // ─── Inconsistencias contra `clima` ───

  // Recalcula coincide_clima para TODOS los registros existentes (los que
  // quedaron en NULL por haberse creado antes de que existiera esta
  // comparación). Se corre una vez; después cada `registrar()` ya calcula
  // el flag al vuelo, así que este método puede volver a llamarse sin
  // problema — es idempotente.
  async recalcularCoincidencias() {
    const registros = await PrecipitacionDiaria.findAll({
      attributes: ['uuid', 'fincaUuid', 'fecha', 'mm'],
      raw: true,
    });

    let actualizados = 0;
    for (const r of registros) {
      const fecha = fechaAIso(r.fecha);
      const coincide = await calcularCoincide(r.fincaUuid, fecha, r.mm);
      await PrecipitacionDiaria.update({ coincideClima: coincide }, { where: { uuid: r.uuid } });
      actualizados += 1;
    }

    return { revisados: actualizados };
  },

  // Lista los registros marcados como no-coincidentes, junto con el valor
  // que tenga (si tiene) el `clima` de esa misma finca+fecha, para que el
  // usuario decida cuál tomar como definitivo. Mismos filtros que list()
  // (Finca/Semana-rango de fechas/Usuario), para que el filtro de arriba
  // de la pantalla aplique a las dos tablas a la vez.
  async listInconsistencias(query = {}) {
    const where = { coincideClima: false };
    if (query.fincaUuid) {
      where.fincaUuid = { [Op.in]: await expandirFincaUuids([query.fincaUuid]) };
    }
    if (query.fechaDesde || query.fechaHasta) {
      where.fecha = {};
      if (query.fechaDesde) where.fecha[Op.gte] = query.fechaDesde;
      if (query.fechaHasta) where.fecha[Op.lte] = query.fechaHasta;
    }
    if (query.usuarioId) where.usuarioId = query.usuarioId;

    const registros = await PrecipitacionDiaria.findAll({
      where,
      include: [{ model: Finca, as: 'finca', attributes: ['nombre'] }],
      order: [['fecha', 'DESC']],
    });

    const resultado = [];
    for (const r of registros) {
      const fecha = fechaAIso(r.fecha);
      const registroClima = await climaService.getByFincaFecha(r.fincaUuid, fecha);
      resultado.push({
        uuid: r.uuid,
        fincaUuid: r.fincaUuid,
        fincaNombre: r.finca?.nombre ?? r.fincaNombre,
        fecha,
        precipitacionDiaria: { mm: Number(r.mm) },
        clima: registroClima
          ? { uuid: registroClima.uuid, mm: registroClima.mm === null ? null : Number(registroClima.mm) }
          : null,
      });
    }
    return resultado;
  },

  // Resuelve una inconsistencia puntual: el usuario elige cuál de los dos
  // valores es el correcto y ESE overwrite explícito es el único momento en
  // que estas dos tablas se escriben cruzadas entre sí.
  //
  // `mmClima` (opcional, solo aplica con fuente="clima"): el usuario puede
  // editar el mm de Clima ahí mismo antes de confirmar, en vez de aceptar a
  // ciegas el valor que ya tenía guardado — si no se manda, se usa el que
  // ya había en `clima`.
  async resolverInconsistencia(uuid, fuente, actorId, actorNombre, mmClima) {
    if (!['precipitacion_diaria', 'clima'].includes(fuente)) {
      throw ApiError.badRequest('fuente debe ser "precipitacion_diaria" o "clima"');
    }

    const registro = await PrecipitacionDiaria.findOne({ where: { uuid } });
    if (!registro) throw ApiError.notFound('Registro no encontrado');

    const fecha = fechaAIso(registro.fecha);
    const registroClima = await climaService.getByFincaFecha(registro.fincaUuid, fecha);

    if (fuente === 'clima') {
      const mmFinal = mmClima !== undefined && mmClima !== null ? Number(mmClima) : registroClima?.mm;
      if (mmFinal === undefined || mmFinal === null || Number.isNaN(mmFinal)) {
        throw ApiError.badRequest('Debes indicar el mm de Clima a usar como definitivo');
      }

      if (registroClima) {
        await sequelize.query('UPDATE clima SET mm = :mm WHERE uuid = :uuid', {
          replacements: { mm: mmFinal, uuid: registroClima.uuid },
        });
      } else {
        // No existía ninguna fila en clima para ese día — se crea con el mm
        // que el usuario acaba de escribir.
        const semana = await Semana.findOne({
          where: { fechaInicio: { [Op.lte]: fecha }, fechaFin: { [Op.gte]: fecha } },
        });
        await climaService.create(
          {
            fincaUuid: registro.fincaUuid,
            fincaNombre: registro.fincaNombre,
            semanaUuid: semana?.uuid,
            semanaCodigo: semana?.codigo,
            fecha,
            mm: mmFinal,
            usuarioNombre: actorNombre,
          },
          actorId,
        );
      }

      await registro.update({ mm: mmFinal, coincideClima: true });
    } else if (registroClima) {
      // Ya existía una fila en clima (con valor real o placeholder sin mm)
      // — se sobreescribe con el de Precipitación Diaria, que se toma como
      // el correcto.
      await sequelize.query('UPDATE clima SET mm = :mm WHERE uuid = :uuid', {
        replacements: { mm: registro.mm, uuid: registroClima.uuid },
      });
      await registro.update({ coincideClima: true });
    } else {
      // No existe ninguna fila en clima para ese día: se crea ya con el mm
      // de Precipitación Diaria (que se tomó como el correcto), no como
      // placeholder vacío.
      const semana = await Semana.findOne({
        where: { fechaInicio: { [Op.lte]: fecha }, fechaFin: { [Op.gte]: fecha } },
      });
      await climaService.create(
        {
          fincaUuid: registro.fincaUuid,
          fincaNombre: registro.fincaNombre,
          semanaUuid: semana?.uuid,
          semanaCodigo: semana?.codigo,
          fecha,
          mm: registro.mm,
          usuarioNombre: actorNombre,
        },
        actorId,
      );
      await registro.update({ coincideClima: true });
    }

    return { uuid, fuente };
  },
};

export default precipitacionDiariaService;
