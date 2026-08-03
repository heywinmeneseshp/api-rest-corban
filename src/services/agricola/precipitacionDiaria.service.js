import crypto from 'crypto';
import { sequelize } from '../../database/connection.js';
import { Finca, Role, Semana } from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';
import { getFincaIdsPermitidas } from '../../utils/fincaScope.js';

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

  tablasVerificadas = true;
};

const ayerIso = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
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

  async registrar(registros, actorId, actorNombre) {
    await ensureTables();
    if (!Array.isArray(registros) || registros.length === 0) {
      throw ApiError.badRequest('Debes enviar al menos un registro');
    }

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

    const resultados = [];
    for (const r of registros) {
      if (!r.fincaUuid || !r.fecha || r.mm === undefined || r.mm === null) {
        throw ApiError.badRequest('Cada registro requiere fincaUuid, fecha y mm');
      }
      const finca = await resolverFinca(r.fincaUuid);
      const uuid = crypto.randomUUID();
      await sequelize.query(
        `INSERT INTO ${TABLE_REGISTRO} (uuid, finca_id, finca_uuid, finca_nombre, fecha, mm, usuario_id, usuario_nombre)
         VALUES (:uuid, :fincaId, :fincaUuid, :fincaNombre, :fecha, :mm, :usuarioId, :usuarioNombre)
         ON DUPLICATE KEY UPDATE mm = VALUES(mm), usuario_id = VALUES(usuario_id), usuario_nombre = VALUES(usuario_nombre)`,
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
          },
        },
      );
      resultados.push({ fincaUuid: finca.uuid, fecha: r.fecha, mm: r.mm });
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
      where += ' AND finca_uuid = :fincaUuid';
      replacements.fincaUuid = query.fincaUuid;
    }
    if (query.fechaDesde) {
      where += ' AND fecha >= :fechaDesde';
      replacements.fechaDesde = query.fechaDesde;
    }
    if (query.fechaHasta) {
      where += ' AND fecha <= :fechaHasta';
      replacements.fechaHasta = query.fechaHasta;
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
    const hoy = new Date().toISOString().slice(0, 10);
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
};

export default precipitacionDiariaService;
