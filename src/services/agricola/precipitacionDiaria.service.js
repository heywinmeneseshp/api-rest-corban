import crypto from 'crypto';
import { Op } from 'sequelize';
import { sequelize } from '../../database/connection.js';
import { Finca, Role, Semana } from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';
import { getFincaIdsPermitidas, expandirFincaUuids } from '../../utils/fincaScope.js';
import { climaService } from './clima.service.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';

// Dos tablas nuevas, separadas del "clima" que registra la app móvil:
// - precipitacion_diaria_config: qué rol debe capturar la precipitación de
//   qué finca, a partir de qué semana (programado por un admin).
// - precipitacion_diaria: el registro día a día en sí, capturado desde
//   app-corbana. No se mezcla con la tabla `clima` (que trae mm/temperatura/
//   humedad por visita de la app móvil, con otra granularidad) — acá es un
//   registro de cumplimiento diario obligatorio por finca.
const TABLE_CONFIG = 'precipitacion_diaria_config';
const TABLE_REGISTRO = 'precipitacion_diaria';

let tablasVerificadas = false;

const ensureTables = async () => {
  if (tablasVerificadas) return;

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE_CONFIG} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      uuid VARCHAR(36) NOT NULL UNIQUE,
      finca_id INT NOT NULL,
      finca_uuid VARCHAR(36) NOT NULL,
      finca_nombre VARCHAR(255),
      rol_id INT NOT NULL,
      rol_nombre VARCHAR(100),
      semana_inicio_uuid VARCHAR(36) NOT NULL,
      semana_inicio_codigo VARCHAR(20),
      fecha_inicio DATE NOT NULL,
      activo TINYINT(1) NOT NULL DEFAULT 1,
      creado_por_nombre VARCHAR(255),
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE_REGISTRO} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      uuid VARCHAR(36) NOT NULL UNIQUE,
      finca_id INT NOT NULL,
      finca_uuid VARCHAR(36) NOT NULL,
      finca_nombre VARCHAR(255),
      fecha DATE NOT NULL,
      mm DECIMAL(8,2) NOT NULL,
      usuario_id INT,
      usuario_nombre VARCHAR(255),
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_finca_fecha (finca_id, fecha)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Marca si el mm de este registro coincide con el que haya en `clima`
  // para la misma finca+fecha — NULL = todavía no comparado (registros
  // viejos antes de que existiera esta columna, hasta que corra el backfill).
  try {
    await sequelize.query(`ALTER TABLE ${TABLE_REGISTRO} ADD COLUMN coincide_clima TINYINT(1) NULL`);
  } catch (err) {
    if (err.original?.errno !== 1060) throw err; // 1060 = la columna ya existe
  }

  tablasVerificadas = true;
};

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

export const precipitacionDiariaService = {
  // ─── Configuración (admin) ───

  async crearConfig({ fincaUuid, rolId, semanaInicioUuid }, actorNombre) {
    await ensureTables();

    const [finca, rol, semana] = await Promise.all([
      Finca.findOne({ where: { uuid: fincaUuid } }),
      Role.findByPk(rolId),
      Semana.findOne({ where: { uuid: semanaInicioUuid } }),
    ]);
    if (!finca) throw ApiError.notFound('Finca no encontrada');
    if (!rol) throw ApiError.notFound('Rol no encontrado');
    if (!semana) throw ApiError.notFound('Semana no encontrada');

    const uuid = crypto.randomUUID();
    await sequelize.query(
      `INSERT INTO ${TABLE_CONFIG} (
         uuid, finca_id, finca_uuid, finca_nombre, rol_id, rol_nombre,
         semana_inicio_uuid, semana_inicio_codigo, fecha_inicio, activo, creado_por_nombre
       ) VALUES (
         :uuid, :fincaId, :fincaUuid, :fincaNombre, :rolId, :rolNombre,
         :semanaInicioUuid, :semanaInicioCodigo, :fechaInicio, 1, :creadoPorNombre
       )`,
      {
        replacements: {
          uuid,
          fincaId: finca.id,
          fincaUuid: finca.uuid,
          fincaNombre: finca.nombre,
          rolId: rol.id,
          rolNombre: rol.nombre,
          semanaInicioUuid: semana.uuid,
          semanaInicioCodigo: semana.codigo,
          fechaInicio: semana.fechaInicio,
          creadoPorNombre: actorNombre || null,
        },
        type: 'INSERT',
      },
    );

    return { uuid };
  },

  async listConfig() {
    await ensureTables();
    // sequelize.query con type: 'SELECT' devuelve el array de filas
    // directo (no [rows, metadata]) — destructurarlo como [rows] tomaba la
    // primera fila en vez del array completo.
    const rows = await sequelize.query(
      `SELECT * FROM ${TABLE_CONFIG} ORDER BY created_at DESC`,
      { type: 'SELECT' },
    );
    return rows;
  },

  async toggleConfig(uuid, activo) {
    await ensureTables();
    const [, affected] = await sequelize.query(
      `UPDATE ${TABLE_CONFIG} SET activo = :activo WHERE uuid = :uuid`,
      { replacements: { activo: activo ? 1 : 0, uuid } },
    );
    if (!affected) throw ApiError.notFound('Configuración no encontrada');
  },

  async eliminarConfig(uuid) {
    await ensureTables();
    await sequelize.query(`DELETE FROM ${TABLE_CONFIG} WHERE uuid = :uuid`, { replacements: { uuid } });
  },

  // ─── Registro diario ───

  async registrar(registros, actorId, actorNombre, user) {
    await ensureTables();
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
      const uuid = crypto.randomUUID();

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

      await sequelize.query(
        `INSERT INTO ${TABLE_REGISTRO} (uuid, finca_id, finca_uuid, finca_nombre, fecha, mm, usuario_id, usuario_nombre, coincide_clima)
         VALUES (:uuid, :fincaId, :fincaUuid, :fincaNombre, :fecha, :mm, :usuarioId, :usuarioNombre, :coincide)
         ON DUPLICATE KEY UPDATE mm = VALUES(mm), usuario_id = VALUES(usuario_id), usuario_nombre = VALUES(usuario_nombre), coincide_clima = VALUES(coincide_clima)`,
        {
          replacements: {
            uuid,
            fincaId: finca.id,
            fincaUuid: finca.uuid,
            fincaNombre: finca.nombre,
            fecha: r.fecha,
            mm: r.mm,
            usuarioId: actorId || null,
            usuarioNombre: actorNombre || null,
            coincide: coincide ? 1 : 0,
          },
        },
      );
      resultados.push({ fincaUuid: finca.uuid, fecha: r.fecha, mm: r.mm, coincideClima: coincide });
    }

    return resultados;
  },

  async list(query) {
    await ensureTables();

    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 50));
    const offset = (page - 1) * limit;

    const replacements = {};
    let where = 'WHERE 1=1';
    if (query.fincaUuid) {
      // Se expande a las fincas hermanas de su Grupo de Finca (ver
      // utils/fincaScope.js), si tiene uno asignado.
      where += ' AND finca_uuid IN (:fincaUuids)';
      replacements.fincaUuids = await expandirFincaUuids([query.fincaUuid]);
    }
    if (query.fechaDesde) {
      where += ' AND fecha >= :fechaDesde';
      replacements.fechaDesde = query.fechaDesde;
    }
    if (query.fechaHasta) {
      where += ' AND fecha <= :fechaHasta';
      replacements.fechaHasta = query.fechaHasta;
    }
    if (query.usuarioId) {
      where += ' AND usuario_id = :usuarioId';
      replacements.usuarioId = query.usuarioId;
    }

    const rows = await sequelize.query(
      `SELECT * FROM ${TABLE_REGISTRO} ${where} ORDER BY fecha DESC LIMIT :limit OFFSET :offset`,
      { replacements: { ...replacements, limit, offset }, type: 'SELECT' },
    );
    const [{ total }] = await sequelize.query(
      `SELECT COUNT(*) AS total FROM ${TABLE_REGISTRO} ${where}`,
      { replacements, type: 'SELECT' },
    );

    return { items: rows, meta: { page, limit, total: Number(total) } };
  },

  // ─── Pendientes (usado por el modal bloqueante al iniciar sesión) ───
  //
  // Para el usuario logueado: junta las config activas cuyo rol coincide con
  // alguno de sus roles y cuya finca esté dentro de las que puede ver, y
  // calcula qué días entre fecha_inicio y ayer todavía no tienen registro.
  async getPendientes(user) {
    await ensureTables();

    const roles = user?.roles || [];
    if (roles.length === 0) return [];

    const configs = await sequelize.query(
      `SELECT * FROM ${TABLE_CONFIG} WHERE activo = 1 AND rol_nombre IN (:roles)`,
      { replacements: { roles }, type: 'SELECT' },
    );
    if (configs.length === 0) return [];

    const fincaIdsPermitidas = getFincaIdsPermitidas(user); // null = sin restricción
    const hoy = hoyIso();
    const ayer = ayerIso();

    // Una finca puede tener más de una config activa (ej. dos roles
    // distintos) — se combinan las fechas faltantes en un solo bloque por
    // finca, usando la fecha_inicio más antigua entre las que apliquen.
    const porFinca = new Map();
    for (const c of configs) {
      if (fincaIdsPermitidas !== null && !fincaIdsPermitidas.includes(c.finca_id)) continue;
      const fechaInicio = c.fecha_inicio instanceof Date ? c.fecha_inicio.toISOString().slice(0, 10) : String(c.fecha_inicio);
      if (fechaInicio > ayer) continue; // todavía no arrancó o arranca hoy/futuro

      const actual = porFinca.get(c.finca_uuid);
      if (!actual || fechaInicio < actual.fechaInicio) {
        porFinca.set(c.finca_uuid, { fincaUuid: c.finca_uuid, fincaNombre: c.finca_nombre, fechaInicio });
      }
    }
    if (porFinca.size === 0) return [];

    const pendientesPorFinca = [];
    for (const { fincaUuid, fincaNombre, fechaInicio } of porFinca.values()) {
      const registrados = await sequelize.query(
        `SELECT fecha FROM ${TABLE_REGISTRO} WHERE finca_uuid = :fincaUuid AND fecha BETWEEN :desde AND :hasta`,
        { replacements: { fincaUuid, desde: fechaInicio, hasta: ayer }, type: 'SELECT' },
      );
      const registradasSet = new Set(
        registrados.map((r) => (r.fecha instanceof Date ? r.fecha.toISOString().slice(0, 10) : String(r.fecha))),
      );

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
    await ensureTables();
    const registros = await sequelize.query(
      `SELECT uuid, finca_uuid, fecha, mm FROM ${TABLE_REGISTRO}`,
      { type: 'SELECT' },
    );

    let actualizados = 0;
    for (const r of registros) {
      const fecha = r.fecha instanceof Date ? r.fecha.toISOString().slice(0, 10) : String(r.fecha);
      const coincide = await calcularCoincide(r.finca_uuid, fecha, r.mm);
      await sequelize.query(
        `UPDATE ${TABLE_REGISTRO} SET coincide_clima = :coincide WHERE uuid = :uuid`,
        { replacements: { coincide: coincide ? 1 : 0, uuid: r.uuid } },
      );
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
    await ensureTables();

    const replacements = {};
    let where = 'WHERE coincide_clima = 0';
    if (query.fincaUuid) {
      where += ' AND finca_uuid IN (:fincaUuids)';
      replacements.fincaUuids = await expandirFincaUuids([query.fincaUuid]);
    }
    if (query.fechaDesde) {
      where += ' AND fecha >= :fechaDesde';
      replacements.fechaDesde = query.fechaDesde;
    }
    if (query.fechaHasta) {
      where += ' AND fecha <= :fechaHasta';
      replacements.fechaHasta = query.fechaHasta;
    }
    if (query.usuarioId) {
      where += ' AND usuario_id = :usuarioId';
      replacements.usuarioId = query.usuarioId;
    }

    const registros = await sequelize.query(
      `SELECT * FROM ${TABLE_REGISTRO} ${where} ORDER BY fecha DESC`,
      { replacements, type: 'SELECT' },
    );

    const resultado = [];
    for (const r of registros) {
      const fecha = r.fecha instanceof Date ? r.fecha.toISOString().slice(0, 10) : String(r.fecha);
      const registroClima = await climaService.getByFincaFecha(r.finca_uuid, fecha);
      resultado.push({
        uuid: r.uuid,
        fincaUuid: r.finca_uuid,
        fincaNombre: r.finca_nombre,
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
    await ensureTables();
    if (!['precipitacion_diaria', 'clima'].includes(fuente)) {
      throw ApiError.badRequest('fuente debe ser "precipitacion_diaria" o "clima"');
    }

    const [registro] = await sequelize.query(
      `SELECT * FROM ${TABLE_REGISTRO} WHERE uuid = :uuid`,
      { replacements: { uuid }, type: 'SELECT' },
    );
    if (!registro) throw ApiError.notFound('Registro no encontrado');

    const fecha = registro.fecha instanceof Date ? registro.fecha.toISOString().slice(0, 10) : String(registro.fecha);
    const registroClima = await climaService.getByFincaFecha(registro.finca_uuid, fecha);

    if (fuente === 'clima') {
      const mmFinal = mmClima !== undefined && mmClima !== null ? Number(mmClima) : registroClima?.mm;
      if (mmFinal === undefined || mmFinal === null || Number.isNaN(mmFinal)) {
        throw ApiError.badRequest('Debes indicar el mm de Clima a usar como definitivo');
      }

      if (registroClima) {
        await sequelize.query(
          `UPDATE clima SET mm = :mm WHERE uuid = :uuid`,
          { replacements: { mm: mmFinal, uuid: registroClima.uuid } },
        );
      } else {
        // No existía ninguna fila en clima para ese día — se crea con el mm
        // que el usuario acaba de escribir.
        const semana = await Semana.findOne({
          where: { fechaInicio: { [Op.lte]: fecha }, fechaFin: { [Op.gte]: fecha } },
        });
        await climaService.create(
          {
            fincaUuid: registro.finca_uuid,
            fincaNombre: registro.finca_nombre,
            semanaUuid: semana?.uuid,
            semanaCodigo: semana?.codigo,
            fecha,
            mm: mmFinal,
            usuarioNombre: actorNombre,
          },
          actorId,
        );
      }

      await sequelize.query(
        `UPDATE ${TABLE_REGISTRO} SET mm = :mm, coincide_clima = 1 WHERE uuid = :uuid`,
        { replacements: { mm: mmFinal, uuid } },
      );
    } else if (registroClima) {
      // Ya existía una fila en clima (con valor real o placeholder sin mm)
      // — se sobreescribe con el de Precipitación Diaria, que se toma como
      // el correcto.
      await sequelize.query(
        `UPDATE clima SET mm = :mm WHERE uuid = :uuid`,
        { replacements: { mm: registro.mm, uuid: registroClima.uuid } },
      );
      await sequelize.query(
        `UPDATE ${TABLE_REGISTRO} SET coincide_clima = 1 WHERE uuid = :uuid`,
        { replacements: { uuid } },
      );
    } else {
      // No existe ninguna fila en clima para ese día: se crea ya con el mm
      // de Precipitación Diaria (que se tomó como el correcto), no como
      // placeholder vacío.
      const semana = await Semana.findOne({
        where: { fechaInicio: { [Op.lte]: fecha }, fechaFin: { [Op.gte]: fecha } },
      });
      await climaService.create(
        {
          fincaUuid: registro.finca_uuid,
          fincaNombre: registro.finca_nombre,
          semanaUuid: semana?.uuid,
          semanaCodigo: semana?.codigo,
          fecha,
          mm: registro.mm,
          usuarioNombre: actorNombre,
        },
        actorId,
      );
      await sequelize.query(
        `UPDATE ${TABLE_REGISTRO} SET coincide_clima = 1 WHERE uuid = :uuid`,
        { replacements: { uuid } },
      );
    }

    return { uuid, fuente };
  },
};

export default precipitacionDiariaService;
