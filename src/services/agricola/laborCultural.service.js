import crypto from 'crypto';
import { sequelize } from '../../database/connection.js';
import { ApiError } from '../../utils/ApiError.js';
import { climaService } from './clima.service.js';

const TABLE = 'labores_culturales';

const ESTADOS = ['Hecho', 'En ejecucion', 'Pendiente'];

// Columnas agregadas después de la creación original de la tabla — en
// instalaciones existentes CREATE TABLE IF NOT EXISTS no las agrega, así que
// se suman con ALTER TABLE ignorando el error si ya existen (1060 =
// ER_DUP_FIELDNAME). El checklist de Moko/Fusarium/protocolos se responde
// UNA vez por visita (no por lote) pero se guarda repetido en cada fila de
// lote de esa misma visita, para no necesitar una tabla aparte.
const COLUMNAS_CHECKLIST = [
  'moko_presente TINYINT(1) NOT NULL DEFAULT 0',
  'moko_lotes TEXT',
  'fusarium_presente TINYINT(1) NOT NULL DEFAULT 0',
  'fusarium_lotes TEXT',
  'cumple_protocolo_foc_r4 TINYINT(1) NOT NULL DEFAULT 0',
  'cumple_protocolo_moko TINYINT(1) NOT NULL DEFAULT 0',
  'checklist_observacion TEXT',
  // visita_uuid agrupa todas las filas de lote cargadas en un mismo envío
  // (un "Finalizar" en la app) — es lo que arma "un solo documento" en el
  // panel admin, como la hoja física de la que sale este módulo. El clima
  // NO se guarda acá — se toma del módulo Clima por finca+fecha (ver
  // getVisita), para no duplicar esa captura entre los dos módulos.
  'visita_uuid VARCHAR(36)',
];

// Evita repetir los 10 ALTER TABLE (con su intento fallido de por medio) en
// cada create()/list() — solo hace falta la primera vez que corre el proceso.
let columnasVerificadas = false;

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

  if (columnasVerificadas) return;
  for (const columna of COLUMNAS_CHECKLIST) {
    try {
      await sequelize.query(`ALTER TABLE ${TABLE} ADD COLUMN ${columna}`);
    } catch (err) {
      if (err.original?.errno !== 1060) throw err; // 1060 = la columna ya existe
    }
  }
  columnasVerificadas = true;
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
      mokoPresente, mokoLotes,
      fusariumPresente, fusariumLotes,
      cumpleProtocoloFocR4, cumpleProtocoloMoko,
      checklistObservacion,
      visitaUuid,
    } = payload;

    if (!fincaUuid || !loteUuid || !semanaUuid || !fecha) {
      throw ApiError.badRequest('Finca, lote, semana y fecha son requeridos');
    }

    validarEstados(payload);

    await sequelize.query(
      `INSERT INTO ${TABLE} (
         uuid, fecha, semana_uuid, semana_codigo, finca_uuid, finca_nombre, lote_uuid, lote_nombre,
         control_maleza, drenajes, desmache, programa_fertilizacion, fitosaneo, reduccion_inoculo,
         observacion, usuario_nombre, usuario_uuid, created_at,
         moko_presente, moko_lotes,
         fusarium_presente, fusarium_lotes,
         cumple_protocolo_foc_r4, cumple_protocolo_moko,
         checklist_observacion,
         visita_uuid
       )
       VALUES (
         :uuid, :fecha, :semanaUuid, :semanaCodigo, :fincaUuid, :fincaNombre, :loteUuid, :loteNombre,
         :controlMaleza, :drenajes, :desmache, :programaFertilizacion, :fitosaneo, :reduccionInoculo,
         :observacion, :usuarioNombre, :usuarioUuid, :createdAt,
         :mokoPresente, :mokoLotes,
         :fusariumPresente, :fusariumLotes,
         :cumpleProtocoloFocR4, :cumpleProtocoloMoko,
         :checklistObservacion,
         :visitaUuid
       )`,
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
          mokoPresente: mokoPresente ? 1 : 0,
          mokoLotes: mokoPresente && mokoLotes?.length ? JSON.stringify(mokoLotes) : null,
          fusariumPresente: fusariumPresente ? 1 : 0,
          fusariumLotes: fusariumPresente && fusariumLotes?.length ? JSON.stringify(fusariumLotes) : null,
          cumpleProtocoloFocR4: cumpleProtocoloFocR4 ? 1 : 0,
          cumpleProtocoloMoko: cumpleProtocoloMoko ? 1 : 0,
          checklistObservacion: checklistObservacion || null,
          visitaUuid: visitaUuid || null,
        },
        type: 'INSERT',
      },
    );

    return { uuid, fincaUuid, loteUuid, fecha, visitaUuid };
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

    // sequelize.query con type: 'SELECT' devuelve el array de filas
    // directo (no [rows, metadata]) — destructurarlo como [rows] tomaba la
    // primera fila en vez del array completo.
    const rows = await sequelize.query(
      `SELECT p.* FROM ${TABLE} p ${where} ORDER BY p.created_at DESC LIMIT :limit OFFSET :offset`,
      { replacements: { ...replacements, limit, offset }, type: 'SELECT' },
    );

    const [{ total }] = await sequelize.query(
      `SELECT COUNT(*) AS total FROM ${TABLE} p ${where}`,
      { replacements, type: 'SELECT' },
    );

    return { items: rows, meta: { page, limit, total: Number(total) } };
  },

  // Una "visita" = todas las filas de lote que comparten visita_uuid (un
  // único "Finalizar" en la app móvil). Este listado arma un renglón por
  // visita para el panel admin, en vez de uno por lote.
  async listVisitas(query) {
    await ensureTable();

    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 50));
    const offset = (page - 1) * limit;

    const replacements = {};
    let where = 'WHERE visita_uuid IS NOT NULL';

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
      `SELECT
         visita_uuid AS visitaUuid,
         finca_uuid AS fincaUuid,
         MAX(finca_nombre) AS fincaNombre,
         fecha,
         MAX(semana_codigo) AS semanaCodigo,
         MAX(usuario_nombre) AS usuarioNombre,
         COUNT(*) AS totalLotes,
         MAX(moko_presente) AS mokoPresente,
         MAX(fusarium_presente) AS fusariumPresente,
         MIN(cumple_protocolo_foc_r4) AS cumpleProtocoloFocR4,
         MIN(cumple_protocolo_moko) AS cumpleProtocoloMoko,
         MIN(created_at) AS createdAt
       FROM ${TABLE}
       ${where}
       GROUP BY visita_uuid, finca_uuid, fecha
       ORDER BY MIN(created_at) DESC
       LIMIT :limit OFFSET :offset`,
      { replacements: { ...replacements, limit, offset }, type: 'SELECT' },
    );

    const [{ total }] = await sequelize.query(
      `SELECT COUNT(*) AS total FROM (
         SELECT visita_uuid FROM ${TABLE} ${where} GROUP BY visita_uuid, finca_uuid, fecha
       ) t`,
      { replacements, type: 'SELECT' },
    );

    return { items: rows, meta: { page, limit, total: Number(total) } };
  },

  // Documento completo de una visita — junta la info compartida (clima,
  // checklist de Moko/Fusarium/protocolos, todo idéntico en cada fila de esa
  // visita) con el detalle de estado fitosanitario por lote.
  async getVisita(visitaUuid) {
    await ensureTable();

    const rows = await sequelize.query(
      `SELECT * FROM ${TABLE} WHERE visita_uuid = :visitaUuid ORDER BY lote_nombre ASC`,
      { replacements: { visitaUuid }, type: 'SELECT' },
    );
    if (!rows.length) throw ApiError.notFound('Visita no encontrada');

    const primero = rows[0];
    // Clima del documento: se toma del módulo Clima por finca+fecha en vez
    // de guardarlo acá también — si ese día no se registró clima para esa
    // finca, el documento simplemente no muestra esa sección.
    const clima = await climaService.getByFincaFecha(primero.finca_uuid, primero.fecha);

    return {
      visitaUuid,
      fincaUuid: primero.finca_uuid,
      fincaNombre: primero.finca_nombre,
      fecha: primero.fecha,
      semanaCodigo: primero.semana_codigo,
      usuarioNombre: primero.usuario_nombre,
      clima: clima
        ? { mm: clima.mm, temperatura: clima.temperatura, humedadRelativa: clima.humedad_relativa }
        : null,
      mokoPresente: Boolean(primero.moko_presente),
      mokoLotes: primero.moko_lotes ? JSON.parse(primero.moko_lotes) : [],
      fusariumPresente: Boolean(primero.fusarium_presente),
      fusariumLotes: primero.fusarium_lotes ? JSON.parse(primero.fusarium_lotes) : [],
      cumpleProtocoloFocR4: Boolean(primero.cumple_protocolo_foc_r4),
      cumpleProtocoloMoko: Boolean(primero.cumple_protocolo_moko),
      checklistObservacion: primero.checklist_observacion,
      lotes: rows.map((r) => ({
        uuid: r.uuid,
        loteUuid: r.lote_uuid,
        loteNombre: r.lote_nombre,
        controlMaleza: r.control_maleza,
        drenajes: r.drenajes,
        desmache: r.desmache,
        programaFertilizacion: r.programa_fertilizacion,
        fitosaneo: r.fitosaneo,
        reduccionInoculo: r.reduccion_inoculo,
        observacion: r.observacion,
      })),
    };
  },
};

export default laborCulturalService;
