import crypto from 'crypto';
import { sequelize } from '../../database/connection.js';
import { ApiError } from '../../utils/ApiError.js';

const TABLE = 'labores_culturales';

const ESTADOS = ['Hecho', 'En ejecucion', 'Pendiente'];

const ensureTable = async () => {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      uuid VARCHAR(36) NOT NULL UNIQUE,
      fecha DATE NOT NULL,
      semana_uuid VARCHAR(36) NOT NULL,
      semana_codigo VARCHAR(20),
      finca_uuid VARCHAR(36) NOT NULL,
      finca_nombre VARCHAR(255),
      lote_uuid VARCHAR(36) NOT NULL,
      lote_nombre VARCHAR(255),
      control_maleza VARCHAR(20) NOT NULL DEFAULT 'Pendiente',
      drenajes VARCHAR(20) NOT NULL DEFAULT 'Pendiente',
      desmache VARCHAR(20) NOT NULL DEFAULT 'Pendiente',
      programa_fertilizacion VARCHAR(20) NOT NULL DEFAULT 'Pendiente',
      fitosaneo VARCHAR(20) NOT NULL DEFAULT 'Pendiente',
      reduccion_inoculo VARCHAR(20) NOT NULL DEFAULT 'Pendiente',
      observacion TEXT,
      usuario_nombre VARCHAR(255),
      usuario_uuid VARCHAR(36),
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
};

const validarEstados = (data) => {
  for (const campo of ['controlMaleza', 'drenajes', 'desmache', 'programaFertilizacion', 'fitosaneo', 'reduccionInoculo']) {
    if (data[campo] && !ESTADOS.includes(data[campo])) {
      throw ApiError.badRequest(`Estado inválido para ${campo}: ${data[campo]}`);
    }
  }
};

export const laborCulturalService = {
  async create(payload, actorId) {
    await ensureTable();

    const {
      uuid, fecha, semanaUuid, semanaCodigo,
      fincaUuid, fincaNombre,
      loteUuid, loteNombre,
      controlMaleza, drenajes, desmache,
      programaFertilizacion, fitosaneo, reduccionInoculo,
      observacion, usuarioNombre, createdAt,
    } = payload;

    if (!fincaUuid || !loteUuid || !semanaUuid || !fecha) {
      throw ApiError.badRequest('Finca, lote, semana y fecha son requeridos');
    }

    validarEstados(payload);

    await sequelize.query(
      `INSERT INTO ${TABLE} (uuid, fecha, semana_uuid, semana_codigo, finca_uuid, finca_nombre, lote_uuid, lote_nombre, control_maleza, drenajes, desmache, programa_fertilizacion, fitosaneo, reduccion_inoculo, observacion, usuario_nombre, usuario_uuid, created_at)
       VALUES (:uuid, :fecha, :semanaUuid, :semanaCodigo, :fincaUuid, :fincaNombre, :loteUuid, :loteNombre, :controlMaleza, :drenajes, :desmache, :programaFertilizacion, :fitosaneo, :reduccionInoculo, :observacion, :usuarioNombre, :usuarioUuid, :createdAt)`,
      {
        replacements: {
          uuid: uuid || crypto.randomUUID(),
          fecha,
          semanaUuid,
          semanaCodigo: semanaCodigo || null,
          fincaUuid,
          fincaNombre: fincaNombre || null,
          loteUuid,
          loteNombre: loteNombre || null,
          controlMaleza: controlMaleza || 'Pendiente',
          drenajes: drenajes || 'Pendiente',
          desmache: desmache || 'Pendiente',
          programaFertilizacion: programaFertilizacion || 'Pendiente',
          fitosaneo: fitosaneo || 'Pendiente',
          reduccionInoculo: reduccionInoculo || 'Pendiente',
          observacion: observacion || null,
          usuarioNombre: usuarioNombre || null,
          usuarioUuid: payload.usuarioUuid || null,
          createdAt: createdAt || new Date().toISOString(),
        },
        type: 'INSERT',
      },
    );

    return { uuid, fincaUuid, loteUuid, fecha };
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

export default laborCulturalService;
