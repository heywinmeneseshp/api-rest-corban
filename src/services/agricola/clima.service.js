import crypto from 'crypto';
import { sequelize } from '../../database/connection.js';
import { ApiError } from '../../utils/ApiError.js';

// Antes era solo "precipitaciones" (columna mm); ahora es el módulo de
// Clima completo (precipitación + temperatura + humedad relativa) — se
// renombra también la tabla física para no dejar un nombre que ya no
// describe lo que guarda. Labores culturales consulta esto por
// finca+fecha en vez de volver a pedir el clima (ver
// laborCultural.service.js/getVisita).
const TABLE = 'clima';
const TABLE_ANTERIOR = 'precipitaciones';

const COLUMNAS_CLIMA = ['temperatura DECIMAL(5,2)', 'humedad_relativa DECIMAL(5,2)'];
let tablaVerificada = false;

const ensureTable = async () => {
  if (tablaVerificada) return;

  // Si ya existe la tabla vieja "precipitaciones" y todavía no la nueva
  // "clima", se renombra en vez de crear una tabla nueva vacía — conserva
  // los datos ya cargados en producción.
  const [[existeAnterior]] = await sequelize.query(
    `SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :t`,
    { replacements: { t: TABLE_ANTERIOR } },
  );
  const [[existeNueva]] = await sequelize.query(
    `SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :t`,
    { replacements: { t: TABLE } },
  );
  if (Number(existeAnterior.c) > 0 && Number(existeNueva.c) === 0) {
    await sequelize.query(`RENAME TABLE ${TABLE_ANTERIOR} TO ${TABLE}`);
  }

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      uuid VARCHAR(36) NOT NULL UNIQUE,
      finca_uuid VARCHAR(36) NOT NULL,
      finca_nombre VARCHAR(255),
      semana_uuid VARCHAR(36) NOT NULL,
      semana_codigo VARCHAR(20),
      fecha DATE NOT NULL,
      mm DECIMAL(8,2) NOT NULL,
      usuario_nombre VARCHAR(255),
      usuario_uuid VARCHAR(36),
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  for (const columna of COLUMNAS_CLIMA) {
    try {
      await sequelize.query(`ALTER TABLE ${TABLE} ADD COLUMN ${columna}`);
    } catch (err) {
      if (err.original?.errno !== 1060) throw err; // 1060 = la columna ya existe
    }
  }
  tablaVerificada = true;
};

export const climaService = {
  async create(payload, actorId) {
    await ensureTable();

    const {
      uuid, fincaUuid, fincaNombre, semanaUuid, semanaCodigo, fecha, mm,
      temperatura, humedadRelativa, usuarioNombre, createdAt,
    } = payload;

    if (!fincaUuid || !semanaUuid || !fecha || mm === undefined) {
      throw ApiError.badRequest('Finca, semana, fecha y mm son requeridos');
    }

    await sequelize.query(
      `INSERT INTO ${TABLE} (
         uuid, finca_uuid, finca_nombre, semana_uuid, semana_codigo, fecha, mm,
         temperatura, humedad_relativa, usuario_nombre, created_at
       )
       VALUES (
         :uuid, :fincaUuid, :fincaNombre, :semanaUuid, :semanaCodigo, :fecha, :mm,
         :temperatura, :humedadRelativa, :usuarioNombre, :createdAt
       )`,
      {
        replacements: {
          uuid: uuid || crypto.randomUUID(),
          fincaUuid,
          fincaNombre: fincaNombre || null,
          semanaUuid,
          semanaCodigo: semanaCodigo || null,
          fecha,
          mm,
          temperatura: temperatura ?? null,
          humedadRelativa: humedadRelativa ?? null,
          usuarioNombre: usuarioNombre || null,
          createdAt: createdAt || new Date().toISOString(),
        },
        type: 'INSERT',
      },
    );

    return { uuid, fincaUuid, semanaUuid, fecha, mm, temperatura, humedadRelativa };
  },

  async list(query) {
    await ensureTable();

    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 50));
    const offset = (page - 1) * limit;

    const replacements = {};
    let where = 'WHERE 1=1';

    if (query.fincaUuid) {
      where += ' AND p.finca_uuid = :fincaUuid';
      replacements.fincaUuid = query.fincaUuid;
    }

    if (query.fechaDesde) {
      where += ' AND p.fecha >= :fechaDesde';
      replacements.fechaDesde = query.fechaDesde;
    }

    if (query.fechaHasta) {
      where += ' AND p.fecha <= :fechaHasta';
      replacements.fechaHasta = query.fechaHasta;
    }

    const [rows] = await sequelize.query(
      `SELECT p.* FROM ${TABLE} p ${where} ORDER BY p.created_at DESC LIMIT :limit OFFSET :offset`,
      { replacements: { ...replacements, limit, offset }, type: 'SELECT' },
    );

    const [{ total }] = await sequelize.query(
      `SELECT COUNT(*) AS total FROM ${TABLE} p ${where}`,
      { replacements, type: 'SELECT' },
    );

    return { items: rows, meta: { page, limit, total: Number(total) } };
  },

  // Usado por labores culturales para "conectar" su documento con el clima
  // ya registrado ese día en esa finca, en vez de volver a pedirlo.
  async getByFincaFecha(fincaUuid, fecha) {
    await ensureTable();
    const [rows] = await sequelize.query(
      `SELECT * FROM ${TABLE} WHERE finca_uuid = :fincaUuid AND fecha = :fecha ORDER BY created_at DESC LIMIT 1`,
      { replacements: { fincaUuid, fecha }, type: 'SELECT' },
    );
    return rows[0] || null;
  },
};

export default climaService;
