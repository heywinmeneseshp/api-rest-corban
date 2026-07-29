import crypto from 'crypto';
import { sequelize } from '../../database/connection.js';
import { ApiError } from '../../utils/ApiError.js';

const TABLE = 'precipitaciones';

const ensureTable = async () => {
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
};

export const precipitacionService = {
  async create(payload, actorId) {
    await ensureTable();

    const { uuid, fincaUuid, fincaNombre, semanaUuid, semanaCodigo, fecha, mm, usuarioNombre, createdAt } = payload;

    if (!fincaUuid || !semanaUuid || !fecha || mm === undefined) {
      throw ApiError.badRequest('Finca, semana, fecha y mm son requeridos');
    }

    await sequelize.query(
      `INSERT INTO ${TABLE} (uuid, finca_uuid, finca_nombre, semana_uuid, semana_codigo, fecha, mm, usuario_nombre, created_at)
       VALUES (:uuid, :fincaUuid, :fincaNombre, :semanaUuid, :semanaCodigo, :fecha, :mm, :usuarioNombre, :createdAt)`,
      {
        replacements: {
          uuid: uuid || crypto.randomUUID(),
          fincaUuid,
          fincaNombre: fincaNombre || null,
          semanaUuid,
          semanaCodigo: semanaCodigo || null,
          fecha,
          mm,
          usuarioNombre: usuarioNombre || null,
          createdAt: createdAt || new Date().toISOString(),
        },
        type: 'INSERT',
      },
    );

    return { uuid, fincaUuid, semanaUuid, fecha, mm };
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
};

export default precipitacionService;
