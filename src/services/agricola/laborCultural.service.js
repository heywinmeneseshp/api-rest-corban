import crypto from 'crypto';
import { sequelize } from '../../database/connection.js';
import { ApiError } from '../../utils/ApiError.js';
import { climaService } from './clima.service.js';
import { expandirFincaUuids, expandirFincaIds, getFincaIdsPermitidas } from '../../utils/fincaScope.js';
import { ROLES } from '../../constants/roles.constants.js';
import { cargarFotosLaborCultural, descargarArchivoDeDrive } from '../googleDrive/cargueFotosLabor.js';
import { Role, User, Finca } from '../../database/associations.js';
import { mailService } from '../sistema/mail.service.js';
import { configuracionService } from '../sistema/configuracion.service.js';
import { logger } from '../../utils/logger.js';

const TABLE = 'labores_culturales';
const TABLE_FOTOS = 'labor_visita_fotos';
// Qué rol(es) pueden marcar una visita como revisada — mismo patrón que
// precipitacion_diaria_config (tabla dinámica rol_id/rol_nombre, sin
// modelo/migración), ver precipitacionDiaria.service.js#getPendientes.
const TABLE_REVISOR = 'sanidad_vegetal_revisor_config';

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
  // Cargo del usuario que hizo la visita, snapshot al momento de crearla
  // (ver create()) — se muestra en el PDF/pantalla en vez de un
  // "Responsable" fijo (el cargo, no el rol de permisos del sistema). Y el
  // "revisado_*": quién y con qué cargo marcó la visita como revisada (ver
  // marcarRevisada()) — null hasta que alguien la revise.
  'usuario_cargo VARCHAR(150)',
  'revisado_por_uuid VARCHAR(36)',
  'revisado_por_nombre VARCHAR(255)',
  'revisado_por_cargo VARCHAR(150)',
  'revisado_en DATETIME NULL',
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

  // Fotos de la visita, subidas a Google Drive — tabla aparte (no una
  // columna más en ${TABLE}) porque son N por visita, no un valor único.
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE_FOTOS} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      uuid VARCHAR(36) NOT NULL UNIQUE,
      visita_uuid VARCHAR(36) NOT NULL,
      id_drive VARCHAR(255) NOT NULL,
      url_drive VARCHAR(500),
      nombre_original VARCHAR(255),
      usuario_uuid VARCHAR(36),
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_visita_uuid (visita_uuid)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE_REVISOR} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      uuid VARCHAR(36) NOT NULL UNIQUE,
      rol_id INT NOT NULL,
      rol_nombre VARCHAR(100),
      activo TINYINT(1) NOT NULL DEFAULT 1,
      creado_por_nombre VARCHAR(255),
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

// null = sin restricción (Administrador, o usuario sin ninguna finca
// asignada). Con restricción, devuelve los uuids de finca permitidos (ya
// expandidos por Grupo de Finca) — labores_culturales guarda finca_uuid, no
// finca_id, así que hay que traducir los ids permitidos a uuids acá.
const getFincaUuidsPermitidas = async (user) => {
  const idsPermitidas = getFincaIdsPermitidas(user);
  if (idsPermitidas === null) return null;
  const idsExpandidos = await expandirFincaIds(idsPermitidas);
  const fincas = await Finca.findAll({ where: { id: idsExpandidos }, attributes: ['uuid'] });
  return fincas.map((f) => f.uuid);
};

// Correos de los usuarios que deben enterarse de una visita de esta finca:
// los que tengan alguno de los roles activos en sanidad_vegetal_revisor_config
// Y (sean Administrador, o no tengan ninguna finca asignada — sin
// restricción, mismo criterio "opt-in" que getFincaUuidsPermitidas, o
// tengan justo esta finca entre las suyas). Se usa tanto para el aviso de
// cargue como para el de revisión — el rol revisor es el mismo en ambos
// casos.
const obtenerDestinatariosRevisores = async (fincaUuid) => {
  await ensureTable();
  const rolesActivos = await sequelize.query(
    `SELECT rol_nombre FROM ${TABLE_REVISOR} WHERE activo = 1`,
    { type: 'SELECT' },
  );
  const nombresRoles = [...new Set(rolesActivos.map((r) => r.rol_nombre).filter(Boolean))];
  if (nombresRoles.length === 0) return [];

  const usuarios = await User.findAll({
    where: { estado: true },
    include: [
      { model: Role, as: 'roles', where: { nombre: nombresRoles }, through: { attributes: [] } },
      { model: Finca, as: 'fincas', through: { attributes: [] }, attributes: ['uuid'], required: false },
    ],
  });

  const correos = usuarios
    .filter((u) => {
      const esAdmin = (u.roles || []).some((r) => r.nombre === ROLES.ADMINISTRADOR);
      const sinFincasAsignadas = !u.fincas || u.fincas.length === 0;
      if (esAdmin || sinFincasAsignadas) return true;
      return u.fincas.some((f) => f.uuid === fincaUuid);
    })
    .map((u) => u.email)
    .filter(Boolean);

  return [...new Set(correos)];
};

// Resuelve la config de CC (correos sueltos + roles completos + usuarios
// puntuales, ver configuracionService.getLaborRevisorCc) a una lista plana
// de emails reales. A diferencia de obtenerDestinatariosRevisores, el CC
// NO se filtra por finca — es una lista "siempre en copia" a propósito
// (ej. un supervisor general, o todo un rol administrativo).
const resolverCcCompleto = async () => {
  const cc = await configuracionService.getLaborRevisorCc();
  const correos = new Set((cc.correos || []).filter(Boolean));

  if (cc.rolesUuids?.length) {
    const usuariosPorRol = await User.findAll({
      where: { estado: true },
      include: [{ model: Role, as: 'roles', where: { uuid: cc.rolesUuids }, through: { attributes: [] } }],
    });
    usuariosPorRol.forEach((u) => u.email && correos.add(u.email));
  }

  if (cc.usuariosUuids?.length) {
    const usuariosPuntuales = await User.findAll({ where: { uuid: cc.usuariosUuids, estado: true } });
    usuariosPuntuales.forEach((u) => u.email && correos.add(u.email));
  }

  return [...correos];
};

export const laborCulturalService = {
  // `actorId`: usuario autenticado que registra la visita — se busca su
  // `cargo` (puesto de trabajo, no el rol de permisos) para snapshotearlo
  // en la visita y mostrarlo en el PDF/pantalla en vez de un "Responsable"
  // fijo.
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

    // El nombre completo para la firma se toma del usuario autenticado
    // (nombre + apellido), no del que mande el cliente — la app móvil solo
    // envía el primer nombre en `usuarioNombre`, y la firma debe llevar
    // nombre y apellido siempre.
    const actor = actorId ? await User.findByPk(actorId, { attributes: ['uuid', 'nombre', 'apellido', 'cargo'] }) : null;
    const usuarioCargo = actor?.cargo || null;
    const usuarioNombreCompleto = actor ? `${actor.nombre} ${actor.apellido}`.trim() : (usuarioNombre || null);
    // El uuid también se toma del usuario autenticado, no del payload — lo
    // necesita updateLote() para verificar que solo quien creó la visita
    // pueda editarla.
    const usuarioUuidReal = actor?.uuid || payload.usuarioUuid || null;

    if (!fincaUuid || !loteUuid || !semanaUuid || !fecha) {
      throw ApiError.badRequest('Finca, lote, semana y fecha son requeridos');
    }

    validarEstados(payload);

    // Se determina ANTES de insertar si esta es la primera fila de la
    // visita (para mandar el aviso de cargue una sola vez por visita, no
    // una vez por lote — create() se llama una vez por cada lote).
    let esPrimeraFilaDeVisita = false;
    if (visitaUuid) {
      const [{ total }] = await sequelize.query(
        `SELECT COUNT(*) AS total FROM ${TABLE} WHERE visita_uuid = :visitaUuid`,
        { replacements: { visitaUuid }, type: 'SELECT' },
      );
      esPrimeraFilaDeVisita = Number(total) === 0;
    }

    await sequelize.query(
      `INSERT INTO ${TABLE} (
         uuid, fecha, semana_uuid, semana_codigo, finca_uuid, finca_nombre, lote_uuid, lote_nombre,
         control_maleza, drenajes, desmache, programa_fertilizacion, fitosaneo, reduccion_inoculo,
         observacion, usuario_nombre, usuario_uuid, usuario_cargo, created_at,
         moko_presente, moko_lotes,
         fusarium_presente, fusarium_lotes,
         cumple_protocolo_foc_r4, cumple_protocolo_moko,
         checklist_observacion,
         visita_uuid
       )
       VALUES (
         :uuid, :fecha, :semanaUuid, :semanaCodigo, :fincaUuid, :fincaNombre, :loteUuid, :loteNombre,
         :controlMaleza, :drenajes, :desmache, :programaFertilizacion, :fitosaneo, :reduccionInoculo,
         :observacion, :usuarioNombre, :usuarioUuid, :usuarioCargo, :createdAt,
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
          usuarioNombre: usuarioNombreCompleto,
          usuarioUuid: usuarioUuidReal,
          usuarioCargo,
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

    // Aviso de cargue: no bloquea la respuesta al cliente (mobile) ni la
    // hace fallar si el correo falla — solo se registra el error.
    if (esPrimeraFilaDeVisita && visitaUuid) {
      obtenerDestinatariosRevisores(fincaUuid)
        .then(async (destinatarios) => {
          const cc = await resolverCcCompleto();
          await mailService.sendAvisoCargueLabor({
            destinatarios,
            cc,
            fincaNombre: fincaNombre || fincaUuid,
            semanaCodigo: semanaCodigo || '—',
            fecha,
          });
        })
        .catch((error) => {
          logger.error('Error al enviar aviso de cargue de labor', { message: error.message, visitaUuid });
        });
    }

    return { uuid, fincaUuid, loteUuid, fecha, visitaUuid };
  },

  // Edita el lote de una visita ya enviada — solo permitido a quien la
  // creó (comparando su uuid autenticado contra el usuario_uuid guardado en
  // create()) y solo mientras nadie la haya marcado como revisada. El
  // checklist de Moko/Fusarium/protocolos se comparte entre todas las filas
  // de la visita (ver COLUMNAS_CHECKLIST), así que se propaga a todas al
  // editar cualquier lote.
  async updateLote(visitaUuid, loteUuid, payload, actorUuid) {
    await ensureTable();

    const filas = await sequelize.query(
      `SELECT lote_uuid, usuario_uuid, revisado_en FROM ${TABLE} WHERE visita_uuid = :visitaUuid`,
      { replacements: { visitaUuid }, type: 'SELECT' },
    );
    if (!filas.length) throw ApiError.notFound('Visita no encontrada');
    if (!filas.some((f) => f.lote_uuid === loteUuid)) {
      throw ApiError.notFound('Ese lote no pertenece a esta visita');
    }
    if (filas[0].revisado_en) {
      throw ApiError.forbidden('No se puede editar una visita que ya fue revisada');
    }
    if (!filas[0].usuario_uuid || filas[0].usuario_uuid !== actorUuid) {
      throw ApiError.forbidden('Solo quien registró la visita puede editarla');
    }

    validarEstados(payload);

    const {
      controlMaleza, drenajes, desmache,
      programaFertilizacion, fitosaneo, reduccionInoculo,
      observacion,
      mokoPresente, mokoLotes,
      fusariumPresente, fusariumLotes,
      cumpleProtocoloFocR4, cumpleProtocoloMoko,
      checklistObservacion,
    } = payload;

    await sequelize.query(
      `UPDATE ${TABLE} SET
         control_maleza = :controlMaleza, drenajes = :drenajes, desmache = :desmache,
         programa_fertilizacion = :programaFertilizacion, fitosaneo = :fitosaneo, reduccion_inoculo = :reduccionInoculo,
         observacion = :observacion
       WHERE visita_uuid = :visitaUuid AND lote_uuid = :loteUuid`,
      {
        replacements: {
          controlMaleza: controlMaleza || 'Pendiente',
          drenajes: drenajes || 'Pendiente',
          desmache: desmache || 'Pendiente',
          programaFertilizacion: programaFertilizacion || 'Pendiente',
          fitosaneo: fitosaneo || 'Pendiente',
          reduccionInoculo: reduccionInoculo || 'Pendiente',
          observacion: observacion || null,
          visitaUuid,
          loteUuid,
        },
      },
    );

    await sequelize.query(
      `UPDATE ${TABLE} SET
         moko_presente = :mokoPresente, moko_lotes = :mokoLotes,
         fusarium_presente = :fusariumPresente, fusarium_lotes = :fusariumLotes,
         cumple_protocolo_foc_r4 = :cumpleProtocoloFocR4, cumple_protocolo_moko = :cumpleProtocoloMoko,
         checklist_observacion = :checklistObservacion
       WHERE visita_uuid = :visitaUuid`,
      {
        replacements: {
          mokoPresente: mokoPresente ? 1 : 0,
          mokoLotes: mokoPresente && mokoLotes?.length ? JSON.stringify(mokoLotes) : null,
          fusariumPresente: fusariumPresente ? 1 : 0,
          fusariumLotes: fusariumPresente && fusariumLotes?.length ? JSON.stringify(fusariumLotes) : null,
          cumpleProtocoloFocR4: cumpleProtocoloFocR4 ? 1 : 0,
          cumpleProtocoloMoko: cumpleProtocoloMoko ? 1 : 0,
          checklistObservacion: checklistObservacion || null,
          visitaUuid,
        },
      },
    );

    return this.getVisita(visitaUuid);
  },

  async list(query) {
    await ensureTable();

    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 50));
    const offset = (page - 1) * limit;

    const replacements = {};
    let where = 'WHERE 1=1';

    if (query.fincaUuid) {
      // Se expande a las fincas hermanas de su Grupo de Finca (ver
      // utils/fincaScope.js), si tiene uno asignado.
      where += ' AND p.finca_uuid IN (:fincaUuids)';
      replacements.fincaUuids = await expandirFincaUuids([query.fincaUuid]);
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
  async listVisitas(query, user) {
    await ensureTable();

    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 50));
    const offset = (page - 1) * limit;

    const replacements = {};
    let where = 'WHERE visita_uuid IS NOT NULL';

    // Un usuario con fincas asignadas solo ve las visitas de esas fincas —
    // sin ninguna asignada (o Administrador) ve todas, sin restricción.
    const fincaUuidsPermitidas = await getFincaUuidsPermitidas(user);
    if (fincaUuidsPermitidas !== null) {
      where += ' AND finca_uuid IN (:fincaUuidsPermitidas)';
      replacements.fincaUuidsPermitidas = fincaUuidsPermitidas.length ? fincaUuidsPermitidas : [null];
    }

    if (query.fincaUuid) {
      // Se expande a las fincas hermanas de su Grupo de Finca (ver
      // utils/fincaScope.js), si tiene uno asignado.
      where += ' AND finca_uuid IN (:fincaUuids)';
      replacements.fincaUuids = await expandirFincaUuids([query.fincaUuid]);
    }
    if (query.loteUuid) {
      // Filtra a nivel de fila: solo entran al GROUP BY las visitas que
      // tengan al menos una fila de ese lote.
      where += ' AND lote_uuid = :loteUuid';
      replacements.loteUuid = query.loteUuid;
    }
    if (query.semanaUuid) {
      where += ' AND semana_uuid = :semanaUuid';
      replacements.semanaUuid = query.semanaUuid;
    }
    if (query.usuarioUuid) {
      where += ' AND usuario_uuid = :usuarioUuid';
      replacements.usuarioUuid = query.usuarioUuid;
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
         MIN(created_at) AS createdAt,
         MAX(revisado_en) AS revisadoEn
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
  // `user`: si viene, se valida que la finca de la visita esté entre las
  // permitidas para ese usuario (ver getFincaUuidsPermitidas) — se omite en
  // llamadas internas donde ya no aplica (ej. updateLote, que ya validó
  // quién puede editar antes de reconsultar el documento actualizado).
  async getVisita(visitaUuid, user) {
    await ensureTable();

    const rows = await sequelize.query(
      `SELECT * FROM ${TABLE} WHERE visita_uuid = :visitaUuid ORDER BY lote_nombre ASC`,
      { replacements: { visitaUuid }, type: 'SELECT' },
    );
    if (!rows.length) throw ApiError.notFound('Visita no encontrada');

    const primero = rows[0];

    if (user) {
      const fincaUuidsPermitidas = await getFincaUuidsPermitidas(user);
      if (fincaUuidsPermitidas !== null && !fincaUuidsPermitidas.includes(primero.finca_uuid)) {
        throw ApiError.notFound('Visita no encontrada');
      }
    }
    // Clima del documento: se toma del módulo Clima por finca+fecha en vez
    // de guardarlo acá también — si ese día no se registró clima para esa
    // finca, el documento simplemente no muestra esa sección.
    const clima = await climaService.getByFincaFecha(primero.finca_uuid, primero.fecha);

    const fotos = await sequelize.query(
      `SELECT uuid, id_drive AS idDrive, url_drive AS urlDrive, nombre_original AS nombreOriginal
       FROM ${TABLE_FOTOS} WHERE visita_uuid = :visitaUuid ORDER BY created_at ASC`,
      { replacements: { visitaUuid }, type: 'SELECT' },
    );

    return {
      visitaUuid,
      fincaUuid: primero.finca_uuid,
      fincaNombre: primero.finca_nombre,
      fecha: primero.fecha,
      semanaCodigo: primero.semana_codigo,
      usuarioNombre: primero.usuario_nombre,
      usuarioUuid: primero.usuario_uuid,
      usuarioCargo: primero.usuario_cargo,
      revisadoPorNombre: primero.revisado_por_nombre,
      revisadoPorCargo: primero.revisado_por_cargo,
      revisadoEn: primero.revisado_en,
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
      fotos,
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

  // Elimina una visita completa (solo Administrador, ver ruta con
  // requireAdmin): borra todas sus filas de lote y sus fotos. Las fotos en
  // Google Drive se dejan como están — la referencia local es lo que se
  // elimina.
  async deleteVisita(visitaUuid) {
    await ensureTable();

    const [primero] = await sequelize.query(
      `SELECT uuid FROM ${TABLE} WHERE visita_uuid = :visitaUuid LIMIT 1`,
      { replacements: { visitaUuid }, type: 'SELECT' },
    );
    if (!primero) throw ApiError.notFound('Visita no encontrada');

    await sequelize.query(
      `DELETE FROM ${TABLE_FOTOS} WHERE visita_uuid = :visitaUuid`,
      { replacements: { visitaUuid }, type: 'DELETE' },
    );
    await sequelize.query(
      `DELETE FROM ${TABLE} WHERE visita_uuid = :visitaUuid`,
      { replacements: { visitaUuid }, type: 'DELETE' },
    );

    return { visitaUuid };
  },

  // Sube las fotos de una visita a Google Drive y guarda la referencia
  // (id + url de Drive) por cada una — la visita ya tiene que existir
  // (se suben después de "Finalizar", no antes).
  async agregarFotos(visitaUuid, archivos, actorId) {
    await ensureTable();

    const [primero] = await sequelize.query(
      `SELECT finca_nombre, semana_codigo, fecha FROM ${TABLE} WHERE visita_uuid = :visitaUuid LIMIT 1`,
      { replacements: { visitaUuid }, type: 'SELECT' },
    );
    if (!primero) throw ApiError.notFound('Visita no encontrada');

    const resultado = await cargarFotosLaborCultural(
      { fincaNombre: primero.finca_nombre, semanaCodigo: primero.semana_codigo, fecha: primero.fecha, visitaUuid },
      archivos,
    );

    for (const foto of resultado.fotos) {
      await sequelize.query(
        `INSERT INTO ${TABLE_FOTOS} (uuid, visita_uuid, id_drive, url_drive, nombre_original, usuario_uuid, created_at)
         VALUES (:uuid, :visitaUuid, :idDrive, :urlDrive, :nombreOriginal, :usuarioUuid, :createdAt)`,
        {
          replacements: {
            uuid: crypto.randomUUID(),
            visitaUuid,
            idDrive: foto.idDrive,
            urlDrive: foto.urlDrive || null,
            nombreOriginal: foto.nombreOriginal || null,
            usuarioUuid: actorId ? String(actorId) : null,
            createdAt: new Date().toISOString(),
          },
          type: 'INSERT',
        },
      );
    }

    return { visitaUuid, totalFotos: resultado.fotos.length, carpetaUrl: resultado.carpetaUrl, fotos: resultado.fotos };
  },

  // Trae el contenido real de una foto (streameado desde Drive) para
  // mostrarla en el panel/PDF — ver descargarArchivoDeDrive. El control de
  // acceso (solo el dueño de la visita o quien tenga LABOR_EVALUACION_VER)
  // se hace en el controlador, igual que en getVisita.
  async obtenerContenidoFoto(fotoUuid) {
    await ensureTable();
    const [foto] = await sequelize.query(
      `SELECT id_drive AS idDrive, visita_uuid AS visitaUuid, nombre_original AS nombreOriginal
       FROM ${TABLE_FOTOS} WHERE uuid = :fotoUuid LIMIT 1`,
      { replacements: { fotoUuid }, type: 'SELECT' },
    );
    if (!foto) throw ApiError.notFound('Foto no encontrada');

    const contenido = await descargarArchivoDeDrive(foto.idDrive);
    return { ...contenido, visitaUuid: foto.visitaUuid, nombreOriginal: foto.nombreOriginal };
  },

  // ─── Configuración: qué rol(es) pueden marcar una visita como revisada ───

  async listRolesRevisores() {
    await ensureTable();
    return sequelize.query(`SELECT * FROM ${TABLE_REVISOR} ORDER BY created_at DESC`, { type: 'SELECT' });
  },

  async crearRolRevisor(rolId, actorId) {
    await ensureTable();
    const rol = await Role.findByPk(rolId);
    if (!rol) throw ApiError.notFound('Rol no encontrado');

    const actor = actorId ? await User.findByPk(actorId, { attributes: ['nombre', 'apellido'] }) : null;
    const actorNombre = actor ? `${actor.nombre} ${actor.apellido}`.trim() : null;

    const uuid = crypto.randomUUID();
    await sequelize.query(
      `INSERT INTO ${TABLE_REVISOR} (uuid, rol_id, rol_nombre, activo, creado_por_nombre)
       VALUES (:uuid, :rolId, :rolNombre, 1, :actorNombre)`,
      { replacements: { uuid, rolId: rol.id, rolNombre: rol.nombre, actorNombre }, type: 'INSERT' },
    );
    return { uuid };
  },

  async toggleRolRevisor(uuid, activo) {
    await ensureTable();
    const [, affected] = await sequelize.query(
      `UPDATE ${TABLE_REVISOR} SET activo = :activo WHERE uuid = :uuid`,
      { replacements: { activo: activo ? 1 : 0, uuid } },
    );
    if (!affected) throw ApiError.notFound('Configuración no encontrada');
  },

  async eliminarRolRevisor(uuid) {
    await ensureTable();
    await sequelize.query(`DELETE FROM ${TABLE_REVISOR} WHERE uuid = :uuid`, { replacements: { uuid } });
  },

  // Marca una visita como revisada — solo si el ROL del usuario está en la
  // config activa de arriba (o es Administrador, que siempre puede); el rol
  // es el mecanismo de permisos de siempre. Lo que queda grabado y firma en
  // el documento es el CARGO del revisor (no el rol), igual criterio que
  // create().
  async marcarRevisada(visitaUuid, user) {
    await ensureTable();

    const [primero] = await sequelize.query(
      `SELECT uuid FROM ${TABLE} WHERE visita_uuid = :visitaUuid LIMIT 1`,
      { replacements: { visitaUuid }, type: 'SELECT' },
    );
    if (!primero) throw ApiError.notFound('Visita no encontrada');

    const rolesActivos = await sequelize.query(
      `SELECT rol_nombre FROM ${TABLE_REVISOR} WHERE activo = 1`,
      { type: 'SELECT' },
    );
    const nombresPermitidos = new Set(rolesActivos.map((r) => r.rol_nombre));
    const rolesUsuario = user?.roles || [];
    const esAdmin = rolesUsuario.includes('Administrador');
    const rolCoincidente = rolesUsuario.find((r) => nombresPermitidos.has(r));

    if (!esAdmin && !rolCoincidente) {
      throw ApiError.forbidden('Tu rol no está autorizado para marcar visitas como revisadas');
    }

    const revisor = user?.id
      ? await User.findByPk(user.id, { attributes: ['nombre', 'apellido', 'cargo'] })
      : null;
    const nombreRevisor = revisor ? `${revisor.nombre} ${revisor.apellido}`.trim() : null;

    await sequelize.query(
      `UPDATE ${TABLE} SET revisado_por_uuid = :uuid, revisado_por_nombre = :nombre, revisado_por_cargo = :cargo, revisado_en = :ahora
       WHERE visita_uuid = :visitaUuid`,
      {
        replacements: {
          uuid: user?.uuid || null,
          nombre: nombreRevisor,
          cargo: revisor?.cargo || null,
          ahora: new Date().toISOString(),
          visitaUuid,
        },
      },
    );

    return { visitaUuid };
  },

  // Manda el aviso de revisión aprobada con el PDF adjunto — el PDF se
  // genera en el navegador (jsPDF, ver lib/visitaLaborExport.js) y llega
  // acá ya armado, porque el backend no tiene un generador de PDF propio.
  // Se llama desde el panel justo después de marcarRevisada().
  async enviarCorreoRevision(visitaUuid, pdfBuffer, pdfNombre) {
    const visita = await this.getVisita(visitaUuid);
    if (!visita.revisadoEn) {
      throw ApiError.badRequest('Esta visita todavía no ha sido marcada como revisada');
    }

    const [destinatarios, cc] = await Promise.all([
      obtenerDestinatariosRevisores(visita.fincaUuid),
      resolverCcCompleto(),
    ]);

    await mailService.sendAvisoRevisionLabor({
      destinatarios,
      cc,
      fincaNombre: visita.fincaNombre || visita.fincaUuid,
      semanaCodigo: visita.semanaCodigo || '—',
      fecha: visita.fecha,
      revisadoPorNombre: visita.revisadoPorNombre || '—',
      pdfBuffer,
      pdfNombre,
    });

    return { enviado: true, destinatarios, cc };
  },
};

export default laborCulturalService;
