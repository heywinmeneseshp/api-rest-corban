import crypto from 'crypto';
import { sequelize } from '../../database/connection.js';
import { Finca, Semana } from '../../database/associations.js';
import { parseBulkFile } from '../../utils/bulkFileParser.js';
import { ApiError } from '../../utils/ApiError.js';
import { expandirFincaUuids, getFincaIdsPermitidas } from '../../utils/fincaScope.js';

// Mismo tope que el resto de los cargues masivos (ver produccionSemanal.service.js
// / racimoMovimiento.service.js) — un archivo demasiado grande no cabe en el
// tiempo de ejecución de la función serverless.
const MAX_FILAS_BULK = 15000;

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
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_finca_fecha (finca_uuid, fecha)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  for (const columna of COLUMNAS_CLIMA) {
    try {
      await sequelize.query(`ALTER TABLE ${TABLE} ADD COLUMN ${columna}`);
    } catch (err) {
      if (err.original?.errno !== 1060) throw err; // 1060 = la columna ya existe
    }
  }

  // Tablas creadas antes de este cambio no tienen el índice único todavía
  // (la CREATE TABLE de arriba solo aplica a instalaciones nuevas) — se
  // agrega acá para que un mismo día no pueda quedar duplicado por dos
  // capturas separadas desde la app móvil (antes solo el uuid era único,
  // así que dos envíos distintos para la misma finca+fecha sí creaban dos
  // filas). Si ya hay datos duplicados de antes, esto va a fallar (error
  // 1062) y hay que limpiarlos a mano antes de que quede activo.
  try {
    await sequelize.query(`ALTER TABLE ${TABLE} ADD UNIQUE KEY uniq_finca_fecha (finca_uuid, fecha)`);
  } catch (err) {
    if (err.original?.errno !== 1061) throw err; // 1061 = la clave ya existe
  }

  // mm empezó como NOT NULL (siempre venía de una captura real), pero ahora
  // el flujo de reconciliación de Precipitación Diaria puede crear una fila
  // "placeholder" sin mm todavía (a la espera de que alguien lo digite desde
  // la app móvil) — se relaja la restricción para permitir eso.
  await sequelize.query(`ALTER TABLE ${TABLE} MODIFY COLUMN mm DECIMAL(8,2) NULL`);

  tablaVerificada = true;
};

// Encuentra la semana cuya fechaInicio/fechaFin contiene `fechaStr`, contra
// una lista de semanas ya cargada en memoria (evita una consulta por fila
// en archivos de miles de filas). `clima.semana_uuid` es NOT NULL, así que
// toda fila válida necesita resolverla a partir de su fecha.
function buscarSemanaPorFecha(semanas, fechaStr) {
  const fecha = new Date(fechaStr);
  return semanas.find((s) => fecha >= new Date(s.fechaInicio) && fecha <= new Date(s.fechaFin));
}

// Valida las filas crudas del archivo contra fincas/semanas y el alcance
// del usuario — mismo criterio que produccionSemanal.service.js.
function validarFilasClima(filas, { fincaPorCodigo, semanas, fincaIdsPermitidas }) {
  const errores = [];
  const filasValidas = [];

  for (let i = 0; i < filas.length; i++) {
    const row = filas[i];
    const nro = i + 2;

    const fincaCodigo = String(row.fincacodigo || row.finca || row.codigofinca || '').trim().toUpperCase();
    const fecha = String(row.fecha || '').trim();
    const mmRaw = Number(row.mm ?? row.precipitacion ?? row.lluvia);
    const temperaturaRaw = row.temperatura !== undefined && row.temperatura !== '' ? Number(row.temperatura) : null;
    const humedadRaw =
      row.humedadrelativa !== undefined && row.humedadrelativa !== ''
        ? Number(row.humedadrelativa)
        : row.humedad !== undefined && row.humedad !== ''
          ? Number(row.humedad)
          : null;

    if (!fincaCodigo) {
      errores.push({ fila: nro, error: 'Código de finca no proporcionado' });
      continue;
    }
    if (!fecha || Number.isNaN(new Date(fecha).getTime())) {
      errores.push({ fila: nro, error: `Fecha "${row.fecha || ''}" no es válida (formato esperado: AAAA-MM-DD)` });
      continue;
    }

    const finca = fincaPorCodigo.get(fincaCodigo);
    if (!finca) {
      errores.push({ fila: nro, error: `Finca "${fincaCodigo}" no encontrada` });
      continue;
    }
    if (fincaIdsPermitidas !== null && !fincaIdsPermitidas.includes(finca.id)) {
      errores.push({ fila: nro, error: `No tienes acceso a la finca "${fincaCodigo}"` });
      continue;
    }

    const semana = buscarSemanaPorFecha(semanas, fecha);
    if (!semana) {
      errores.push({ fila: nro, error: `No existe una semana registrada para la fecha "${fecha}"` });
      continue;
    }

    if (!Number.isFinite(mmRaw) || mmRaw < 0) {
      errores.push({ fila: nro, error: `mm "${row.mm ?? ''}" no es un número válido` });
      continue;
    }
    if (temperaturaRaw !== null && !Number.isFinite(temperaturaRaw)) {
      errores.push({ fila: nro, error: `Temperatura "${row.temperatura}" no es un número válido` });
      continue;
    }
    if (humedadRaw !== null && !Number.isFinite(humedadRaw)) {
      errores.push({ fila: nro, error: `Humedad relativa "${row.humedadrelativa ?? row.humedad}" no es un número válido` });
      continue;
    }

    filasValidas.push({
      fincaUuid: finca.uuid,
      fincaNombre: finca.nombre,
      semanaUuid: semana.uuid,
      semanaCodigo: semana.codigo,
      fecha,
      mm: mmRaw,
      temperatura: temperaturaRaw,
      humedadRelativa: humedadRaw,
    });
  }

  return { filasValidas, errores };
}

// Si ya existe un registro de precipitacion_diaria para esta misma
// finca+fecha, recalcula su flag coincide_clima con el mm que se acaba de
// guardar acá — así el reporte de inconsistencias no queda desactualizado
// cuando el orden de captura es "primero clima, después Precipitación
// Diaria" (o al revés, y clima llega más tarde a completar el mm). Nunca
// escribe el mm en ninguna de las dos tablas, solo el flag de comparación.
// Es SQL crudo directo (no importa precipitacionDiaria.service.js) para no
// generar un import circular entre ambos servicios.
const sincronizarPrecipitacionDiaria = async (fincaUuid, fecha, mm) => {
  const [registro] = await sequelize.query(
    `SELECT uuid, mm AS mm_registrado FROM precipitacion_diaria WHERE finca_uuid = :fincaUuid AND fecha = :fecha`,
    { replacements: { fincaUuid, fecha }, type: 'SELECT' },
  );
  if (!registro) return; // todavía no hay nada que comparar para ese día

  const coincide = mm !== null && mm !== undefined && Number(registro.mm_registrado) === Number(mm);
  await sequelize.query(
    `UPDATE precipitacion_diaria SET coincide_clima = :coincide WHERE uuid = :uuid`,
    { replacements: { coincide: coincide ? 1 : 0, uuid: registro.uuid } },
  );
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

    // ON DUPLICATE KEY UPDATE por el índice único finca_uuid+fecha — si ya
    // existe un registro para ese día (dos capturas separadas, o el
    // placeholder que crea la reconciliación de Precipitación Diaria), se
    // actualiza en vez de quedar duplicado.
    await sequelize.query(
      `INSERT INTO ${TABLE} (
         uuid, finca_uuid, finca_nombre, semana_uuid, semana_codigo, fecha, mm,
         temperatura, humedad_relativa, usuario_nombre, created_at
       )
       VALUES (
         :uuid, :fincaUuid, :fincaNombre, :semanaUuid, :semanaCodigo, :fecha, :mm,
         :temperatura, :humedadRelativa, :usuarioNombre, :createdAt
       )
       ON DUPLICATE KEY UPDATE
         mm = VALUES(mm), temperatura = VALUES(temperatura), humedad_relativa = VALUES(humedad_relativa),
         semana_uuid = VALUES(semana_uuid), semana_codigo = VALUES(semana_codigo),
         usuario_nombre = VALUES(usuario_nombre)`,
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

    await sincronizarPrecipitacionDiaria(fincaUuid, fecha, mm);

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

  // Cargue masivo desde .csv/.xlsx. Columnas esperadas: fincaCodigo, fecha
  // (AAAA-MM-DD), mm, temperatura (opcional), humedadRelativa (opcional).
  // La semana se resuelve automáticamente a partir de la fecha (no es una
  // columna del archivo). Si ya existe un registro para la misma finca+fecha,
  // se omite (igual criterio que produccionSemanal: "crea, salta duplicados").
  // `actorId` no se usa: a diferencia de otras tablas, `clima` no tiene una
  // columna created_by (solo usuario_nombre/usuario_uuid, pensados para la
  // captura individual desde la app móvil) — se mantiene el parámetro para
  // que la firma sea consistente con el resto de los bulkCreate*.
  async bulkCreateClima(file, _actorId, user) {
    await ensureTable();

    const filas = parseBulkFile(file);
    if (filas.length === 0) throw ApiError.badRequest('El archivo está vacío');

    if (filas.length > MAX_FILAS_BULK) {
      throw ApiError.badRequest(
        `El archivo tiene ${filas.length.toLocaleString('es')} filas — el máximo por cargue es ${MAX_FILAS_BULK.toLocaleString('es')}. ` +
          'Dividilo en partes más chicas (por ejemplo, por año) y subilas una por una.',
      );
    }

    const fincaIdsPermitidas = getFincaIdsPermitidas(user);
    const [todasFincas, todasSemanas] = await Promise.all([
      Finca.findAll({ attributes: ['id', 'uuid', 'codigo', 'nombre'] }),
      Semana.findAll({ attributes: ['id', 'uuid', 'codigo', 'fechaInicio', 'fechaFin'] }),
    ]);
    const fincaPorCodigo = new Map(todasFincas.map((f) => [f.codigo, f]));

    const { filasValidas, errores } = validarFilasClima(filas, {
      fincaPorCodigo,
      semanas: todasSemanas,
      fincaIdsPermitidas,
    });

    if (filasValidas.length === 0) {
      return { totalFilas: filas.length, creados: 0, errores };
    }

    // Descarta duplicados finca+fecha contra lo que ya hay en la tabla —
    // `clima` es SQL crudo sin índice único, así que se arma el set a mano.
    const fincaUuids = [...new Set(filasValidas.map((f) => f.fincaUuid))];
    const existentes = await sequelize.query(
      `SELECT finca_uuid AS fincaUuid, fecha FROM ${TABLE} WHERE finca_uuid IN (:fincaUuids)`,
      { replacements: { fincaUuids }, type: 'SELECT' },
    );
    const existenteSet = new Set(
      existentes.map((e) => `${e.fincaUuid}-${new Date(e.fecha).toISOString().slice(0, 10)}`),
    );

    // También descarta duplicados DENTRO del mismo archivo (dos filas para
    // la misma finca+fecha) — como no hay índice único real en la tabla,
    // nada más lo evitaría y quedarían dos registros para el mismo día.
    const aInsertar = [];
    for (const f of filasValidas) {
      const clave = `${f.fincaUuid}-${f.fecha}`;
      if (existenteSet.has(clave)) continue;
      existenteSet.add(clave);
      aInsertar.push(f);
    }
    const saltados = filasValidas.length - aInsertar.length;

    // Se inserta en lotes (no todo en un solo INSERT) para no armar una
    // sentencia gigante con archivos de miles de filas.
    const FILAS_POR_INSERT = 1000;
    for (let inicio = 0; inicio < aInsertar.length; inicio += FILAS_POR_INSERT) {
      const lote = aInsertar.slice(inicio, inicio + FILAS_POR_INSERT);
      const valoresSql = lote
        .map(
          (_, i) =>
            `(:uuid${i}, :fincaUuid${i}, :fincaNombre${i}, :semanaUuid${i}, :semanaCodigo${i}, :fecha${i}, :mm${i}, :temperatura${i}, :humedadRelativa${i}, :createdAt${i})`,
        )
        .join(',');
      const replacements = {};
      const ahora = new Date().toISOString();
      lote.forEach((f, i) => {
        replacements[`uuid${i}`] = crypto.randomUUID();
        replacements[`fincaUuid${i}`] = f.fincaUuid;
        replacements[`fincaNombre${i}`] = f.fincaNombre;
        replacements[`semanaUuid${i}`] = f.semanaUuid;
        replacements[`semanaCodigo${i}`] = f.semanaCodigo;
        replacements[`fecha${i}`] = f.fecha;
        replacements[`mm${i}`] = f.mm;
        replacements[`temperatura${i}`] = f.temperatura;
        replacements[`humedadRelativa${i}`] = f.humedadRelativa;
        replacements[`createdAt${i}`] = ahora;
      });
      await sequelize.query(
        `INSERT INTO ${TABLE} (
           uuid, finca_uuid, finca_nombre, semana_uuid, semana_codigo, fecha, mm,
           temperatura, humedad_relativa, created_at
         ) VALUES ${valoresSql}`,
        { replacements, type: 'INSERT' },
      );
    }

    return {
      totalFilas: filas.length,
      creados: aInsertar.length,
      saltados,
      errores: errores.length > 0 ? errores : undefined,
    };
  },

  // Usado por labores culturales para "conectar" su documento con el clima
  // ya registrado ese día en esa finca, en vez de volver a pedirlo.
  async getByFincaFecha(fincaUuid, fecha) {
    await ensureTable();
    const [row] = await sequelize.query(
      `SELECT * FROM ${TABLE} WHERE finca_uuid = :fincaUuid AND fecha = :fecha ORDER BY created_at DESC LIMIT 1`,
      { replacements: { fincaUuid, fecha }, type: 'SELECT' },
    );
    return row || null;
  },

  // Promedio semanal de mm/temperatura/humedad — usado por el gráfico de
  // Clima. Se agrupa por semana_uuid (no por fecha suelta) para que quede
  // una serie prolija aunque haya varias capturas por semana en una finca.
  // Las filas con mm/temperatura/humedad en NULL (placeholders de la
  // reconciliación con Precipitación Diaria, o capturas sin esos datos
  // opcionales) se excluyen de cada promedio individualmente, así no bajan
  // artificialmente el número por sumar un NULL como si fuera cero — es lo
  // que ya hace AVG() en SQL con columnas nulas, no hace falta filtrarlas
  // a mano.
  async promedioSemanal(query) {
    await ensureTable();

    const replacements = {};
    let where = 'WHERE 1=1';
    if (query.fincaUuid) {
      where += ' AND finca_uuid IN (:fincaUuids)';
      replacements.fincaUuids = await expandirFincaUuids([query.fincaUuid]);
    }

    const rows = await sequelize.query(
      `SELECT
         semana_uuid AS semanaUuid,
         semana_codigo AS semanaCodigo,
         MIN(fecha) AS fechaReferencia,
         AVG(mm) AS promedioMm,
         AVG(temperatura) AS promedioTemperatura,
         AVG(humedad_relativa) AS promedioHumedad
       FROM ${TABLE}
       ${where}
       GROUP BY semana_uuid, semana_codigo
       ORDER BY fechaReferencia ASC`,
      { replacements, type: 'SELECT' },
    );

    return {
      items: rows.map((r) => ({
        semanaUuid: r.semanaUuid,
        semanaCodigo: r.semanaCodigo,
        promedioMm: r.promedioMm !== null ? Number(r.promedioMm) : null,
        promedioTemperatura: r.promedioTemperatura !== null ? Number(r.promedioTemperatura) : null,
        promedioHumedad: r.promedioHumedad !== null ? Number(r.promedioHumedad) : null,
      })),
    };
  },
};

export default climaService;
