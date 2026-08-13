import crypto from 'crypto';
import { sequelize } from '../../database/connection.js';
import { Finca, Semana } from '../../database/associations.js';
import { parseBulkFile } from '../../utils/bulkFileParser.js';
import { ApiError } from '../../utils/ApiError.js';
import { expandirFincaUuids, getFincaIdsPermitidas } from '../../utils/fincaScope.js';
import { semanaRepository } from '../../repositories/agricola/semana.repository.js';

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

  // Serie semanal de precipitación/temperatura/humedad — usado por el
  // gráfico de Clima. Precipitación (`totalMm`) es el TOTAL acumulado de la
  // semana; temperatura y humedad (`promedioTemperatura`/`promedioHumedad`)
  // siguen siendo un promedio (sumar temperaturas no tiene sentido).
  //
  // La precipitación se calcula sobre TODOS los días del rango real de
  // captura de cada finca (desde su primera hasta su última captura), no
  // solo sobre los días que tienen fila en `clima`: un día sin registro
  // dentro de ese rango cuenta como 0mm (se asume que no llovió, no que
  // falta el dato) — así el total semanal no queda subestimado por semanas
  // con capturas incompletas. Fuera de ese rango (antes de la primera
  // captura o después de la última) no se asume nada, esos días ni
  // siquiera se consideran.
  //
  // Temperatura y humedad NO se rellenan con 0 — no tiene sentido asumir
  // 0°C o 0% de humedad para un día sin captura — siguen promediándose
  // solo sobre los días con dato real, igual que antes.
  //
  // `query.anio` (opcional): filtra a un año calendario puntual y devuelve
  // `numeroSemana` (1-53) — necesario para poder superponer el mismo
  // gráfico de años distintos alineados por semana del año (mismo criterio
  // que dashboardService.getResumen). Sin `anio`, trae todas las semanas de
  // todos los años, en orden cronológico.
  async promedioSemanal(query) {
    await ensureTable();

    let fincaUuids = null; // null = todas las fincas
    if (query.fincaUuid) {
      fincaUuids = await expandirFincaUuids(query.fincaUuid.split(','));
    }
    const whereFinca = fincaUuids ? 'WHERE finca_uuid IN (:fincaUuids)' : '';
    const replacementsFinca = fincaUuids ? { fincaUuids } : {};

    // Rango real de captura de cada finca en el alcance pedido — el relleno
    // de 0mm en días sin registro solo aplica DENTRO de este rango.
    const rangosPorFinca = await sequelize.query(
      `SELECT finca_uuid AS fincaUuid, MIN(fecha) AS desde, MAX(fecha) AS hasta FROM ${TABLE} ${whereFinca} GROUP BY finca_uuid`,
      { replacements: replacementsFinca, type: 'SELECT' },
    );

    const aniosDisponibles = await semanaRepository.findAniosDistintos();
    if (rangosPorFinca.length === 0) return { items: [], aniosDisponibles };

    // Todas las filas reales (mm/temperatura/humedad) de esas fincas, para
    // buscar por finca+fecha sin una consulta por día.
    const filasReales = await sequelize.query(
      `SELECT finca_uuid AS fincaUuid, fecha, mm, temperatura, humedad_relativa AS humedadRelativa FROM ${TABLE} ${whereFinca}`,
      { replacements: replacementsFinca, type: 'SELECT' },
    );
    const aIso = (f) => (f instanceof Date ? f.toISOString().slice(0, 10) : String(f).slice(0, 10));
    const realPorFincaFecha = new Map(filasReales.map((f) => [`${f.fincaUuid}-${aIso(f.fecha)}`, f]));

    // Mapa fecha -> semana, armado una sola vez recorriendo cada semana (no
    // cada día contra todas las semanas) — mucho más barato.
    const semanas = await Semana.findAll({
      attributes: ['uuid', 'codigo', 'anio', 'numeroSemana', 'fechaInicio', 'fechaFin'],
      raw: true,
    });
    const semanaPorFecha = new Map();
    const unDiaMs = 24 * 60 * 60 * 1000;
    for (const s of semanas) {
      const inicio = new Date(s.fechaInicio).getTime();
      const fin = new Date(s.fechaFin).getTime();
      for (let t = inicio; t <= fin; t += unDiaMs) {
        semanaPorFecha.set(new Date(t).toISOString().slice(0, 10), s);
      }
    }

    // Acumula día a día (todo el rango real de cada finca) por semana.
    const acumPorSemana = new Map();
    for (const r of rangosPorFinca) {
      const desde = new Date(r.desde).getTime();
      const hasta = new Date(r.hasta).getTime();
      for (let t = desde; t <= hasta; t += unDiaMs) {
        const fechaIso = new Date(t).toISOString().slice(0, 10);
        const semana = semanaPorFecha.get(fechaIso);
        if (!semana) continue; // fecha fuera de cualquier semana cargada (no debería pasar)

        const real = realPorFincaFecha.get(`${r.fincaUuid}-${fechaIso}`);
        const mm = real && real.mm !== null ? Number(real.mm) : 0; // sin captura ese día -> 0mm

        if (!acumPorSemana.has(semana.uuid)) {
          acumPorSemana.set(semana.uuid, {
            semanaCodigo: semana.codigo,
            numeroSemana: semana.numeroSemana,
            anio: semana.anio,
            fecha: semana.fechaInicio,
            sumaMm: 0,
            countMm: 0,
            sumaTemp: 0,
            countTemp: 0,
            sumaHum: 0,
            countHum: 0,
          });
        }
        const acc = acumPorSemana.get(semana.uuid);
        acc.sumaMm += mm;
        acc.countMm += 1;
        if (real && real.temperatura !== null) {
          acc.sumaTemp += Number(real.temperatura);
          acc.countTemp += 1;
        }
        if (real && real.humedadRelativa !== null) {
          acc.sumaHum += Number(real.humedadRelativa);
          acc.countHum += 1;
        }
      }
    }

    let items = [...acumPorSemana.entries()].map(([semanaUuid, a]) => ({
      semanaUuid,
      semanaCodigo: a.semanaCodigo,
      numeroSemana: a.numeroSemana,
      anio: a.anio,
      fecha: a.fecha instanceof Date ? a.fecha.toISOString().slice(0, 10) : String(a.fecha).slice(0, 10),
      // Precipitación: TOTAL de la semana (suma de los 7 días, contando 0 los
      // que no tienen captura) — a diferencia de temperatura/humedad, que sí
      // siguen siendo un promedio (sumar temperaturas no significa nada).
      totalMm: a.countMm > 0 ? Math.round(a.sumaMm * 100) / 100 : null,
      promedioTemperatura: a.countTemp > 0 ? Math.round((a.sumaTemp / a.countTemp) * 100) / 100 : null,
      promedioHumedad: a.countHum > 0 ? Math.round((a.sumaHum / a.countHum) * 100) / 100 : null,
    }));

    if (query.anio) {
      items = items.filter((it) => it.anio === Number(query.anio));
    }
    items.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    return { items, aniosDisponibles };
  },

  // Detalle por finca de UNA semana puntual — usado al hacer clic en un
  // punto del gráfico de Clima, para ver qué finca aportó qué del total
  // combinado ("Todas las fincas"). Mismo criterio de 0mm en días sin
  // captura que promedioSemanal, pero acá agrupado por finca en vez de
  // sumado entre todas — y solo se incluyen fincas cuyo rango real de
  // captura efectivamente cubre esta semana (si una finca todavía no
  // capturaba nada en esa fecha, no aparece con un 0 engañoso).
  async detalleSemanaPorFinca(semanaUuid, query = {}) {
    await ensureTable();
    if (!semanaUuid) throw ApiError.badRequest('Debes indicar semanaUuid');

    const semana = await Semana.findOne({ where: { uuid: semanaUuid }, raw: true });
    if (!semana) throw ApiError.notFound('Semana no encontrada');

    let fincaUuids = null;
    if (query.fincaUuid) {
      fincaUuids = await expandirFincaUuids(query.fincaUuid.split(','));
    }
    const whereFinca = fincaUuids ? 'AND finca_uuid IN (:fincaUuids)' : '';
    const replacementsFinca = fincaUuids ? { fincaUuids } : {};

    const rangosPorFinca = await sequelize.query(
      `SELECT finca_uuid AS fincaUuid, finca_nombre AS fincaNombre, MIN(fecha) AS desde, MAX(fecha) AS hasta
       FROM ${TABLE} WHERE 1=1 ${whereFinca} GROUP BY finca_uuid, finca_nombre`,
      { replacements: replacementsFinca, type: 'SELECT' },
    );

    const inicioSemana = new Date(semana.fechaInicio).getTime();
    const finSemana = new Date(semana.fechaFin).getTime();
    const unDiaMs = 24 * 60 * 60 * 1000;

    const filasReales = await sequelize.query(
      `SELECT finca_uuid AS fincaUuid, fecha, mm, temperatura, humedad_relativa AS humedadRelativa
       FROM ${TABLE} WHERE fecha BETWEEN :desde AND :hasta ${whereFinca}`,
      { replacements: { ...replacementsFinca, desde: semana.fechaInicio, hasta: semana.fechaFin }, type: 'SELECT' },
    );
    const aIso = (f) => (f instanceof Date ? f.toISOString().slice(0, 10) : String(f).slice(0, 10));
    const realPorFincaFecha = new Map(filasReales.map((f) => [`${f.fincaUuid}-${aIso(f.fecha)}`, f]));

    const detalle = [];
    for (const r of rangosPorFinca) {
      const desdeFinca = new Date(r.desde).getTime();
      const hastaFinca = new Date(r.hasta).getTime();
      // Esta finca no estaba siendo monitoreada todavía (o ya no) durante
      // esta semana — no se le asigna ni un 0, directamente no aplica.
      if (hastaFinca < inicioSemana || desdeFinca > finSemana) continue;

      let sumaMm = 0;
      let countMm = 0;
      let sumaTemp = 0;
      let countTemp = 0;
      let sumaHum = 0;
      let countHum = 0;
      const desdeDia = Math.max(inicioSemana, desdeFinca);
      const hastaDia = Math.min(finSemana, hastaFinca);
      for (let t = desdeDia; t <= hastaDia; t += unDiaMs) {
        const fechaIso = new Date(t).toISOString().slice(0, 10);
        const real = realPorFincaFecha.get(`${r.fincaUuid}-${fechaIso}`);
        sumaMm += real && real.mm !== null ? Number(real.mm) : 0;
        countMm += 1;
        if (real && real.temperatura !== null) {
          sumaTemp += Number(real.temperatura);
          countTemp += 1;
        }
        if (real && real.humedadRelativa !== null) {
          sumaHum += Number(real.humedadRelativa);
          countHum += 1;
        }
      }

      detalle.push({
        fincaUuid: r.fincaUuid,
        fincaNombre: r.fincaNombre,
        totalMm: countMm > 0 ? Math.round(sumaMm * 100) / 100 : null,
        promedioTemperatura: countTemp > 0 ? Math.round((sumaTemp / countTemp) * 100) / 100 : null,
        promedioHumedad: countHum > 0 ? Math.round((sumaHum / countHum) * 100) / 100 : null,
      });
    }

    detalle.sort((a, b) => (b.totalMm || 0) - (a.totalMm || 0));

    return { semanaCodigo: semana.codigo, fincas: detalle };
  },

  // Serie temporal configurable — usada por el gráfico expandido de Clima,
  // que permite elegir ver por día, semana o mes (a diferencia de
  // promedioSemanal, que solo sabe semanal). Mismo criterio de relleno de
  // 0mm en precipitación dentro del rango real de captura de cada finca, y
  // mismo criterio de que temperatura/humedad no se rellenan.
  //
  // Cada item trae `periodo`, un número que ubica ese punto DENTRO de su
  // año (día del año 1-366, semana 1-53, o mes 1-12) — para poder alinear
  // en el mismo eje puntos de años distintos, igual que ya hace
  // promedioSemanal con `numeroSemana`.
  async serieClima(query) {
    await ensureTable();

    const granularidad = ['dia', 'mes'].includes(query.granularidad) ? query.granularidad : 'semana';

    let fincaUuids = null;
    if (query.fincaUuid) {
      fincaUuids = await expandirFincaUuids(query.fincaUuid.split(','));
    }
    const whereFinca = fincaUuids ? 'WHERE finca_uuid IN (:fincaUuids)' : '';
    const replacementsFinca = fincaUuids ? { fincaUuids } : {};

    const rangosPorFinca = await sequelize.query(
      `SELECT finca_uuid AS fincaUuid, MIN(fecha) AS desde, MAX(fecha) AS hasta FROM ${TABLE} ${whereFinca} GROUP BY finca_uuid`,
      { replacements: replacementsFinca, type: 'SELECT' },
    );

    const aniosDisponibles = await semanaRepository.findAniosDistintos();
    if (rangosPorFinca.length === 0) return { items: [], aniosDisponibles, granularidad };

    const filasReales = await sequelize.query(
      `SELECT finca_uuid AS fincaUuid, fecha, mm, temperatura, humedad_relativa AS humedadRelativa FROM ${TABLE} ${whereFinca}`,
      { replacements: replacementsFinca, type: 'SELECT' },
    );
    const aIso = (f) => (f instanceof Date ? f.toISOString().slice(0, 10) : String(f).slice(0, 10));
    const realPorFincaFecha = new Map(filasReales.map((f) => [`${f.fincaUuid}-${aIso(f.fecha)}`, f]));

    // Solo se arma el mapa fecha->semana si hace falta (granularidad semanal).
    let semanaPorFecha = null;
    const unDiaMs = 24 * 60 * 60 * 1000;
    if (granularidad === 'semana') {
      const semanas = await Semana.findAll({
        attributes: ['uuid', 'codigo', 'anio', 'numeroSemana', 'fechaInicio', 'fechaFin'],
        raw: true,
      });
      semanaPorFecha = new Map();
      for (const s of semanas) {
        const inicio = new Date(s.fechaInicio).getTime();
        const fin = new Date(s.fechaFin).getTime();
        for (let t = inicio; t <= fin; t += unDiaMs) {
          semanaPorFecha.set(new Date(t).toISOString().slice(0, 10), s);
        }
      }
    }

    const diaDelAnio = (fechaIso) => {
      const d = new Date(`${fechaIso}T00:00:00Z`);
      const inicioAnio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      return Math.floor((d - inicioAnio) / unDiaMs) + 1;
    };

    const acum = new Map();
    for (const r of rangosPorFinca) {
      const desde = new Date(r.desde).getTime();
      const hasta = new Date(r.hasta).getTime();
      for (let t = desde; t <= hasta; t += unDiaMs) {
        const fechaIso = new Date(t).toISOString().slice(0, 10);
        const real = realPorFincaFecha.get(`${r.fincaUuid}-${fechaIso}`);
        const mm = real && real.mm !== null ? Number(real.mm) : 0;

        let clave;
        let meta;
        if (granularidad === 'dia') {
          clave = fechaIso;
          meta = { fecha: fechaIso, anio: Number(fechaIso.slice(0, 4)), periodo: diaDelAnio(fechaIso) };
        } else if (granularidad === 'mes') {
          clave = fechaIso.slice(0, 7);
          meta = { fecha: `${clave}-01`, anio: Number(clave.slice(0, 4)), periodo: Number(clave.slice(5, 7)) };
        } else {
          const semana = semanaPorFecha.get(fechaIso);
          if (!semana) continue;
          clave = semana.uuid;
          meta = {
            fecha: semana.fechaInicio,
            anio: semana.anio,
            periodo: semana.numeroSemana,
            semanaUuid: semana.uuid,
            semanaCodigo: semana.codigo,
          };
        }

        if (!acum.has(clave)) {
          acum.set(clave, { ...meta, sumaMm: 0, countMm: 0, sumaTemp: 0, countTemp: 0, sumaHum: 0, countHum: 0 });
        }
        const acc = acum.get(clave);
        acc.sumaMm += mm;
        acc.countMm += 1;
        if (real && real.temperatura !== null) {
          acc.sumaTemp += Number(real.temperatura);
          acc.countTemp += 1;
        }
        if (real && real.humedadRelativa !== null) {
          acc.sumaHum += Number(real.humedadRelativa);
          acc.countHum += 1;
        }
      }
    }

    let items = [...acum.values()].map((a) => ({
      fecha: a.fecha instanceof Date ? a.fecha.toISOString().slice(0, 10) : String(a.fecha).slice(0, 10),
      anio: a.anio,
      periodo: a.periodo,
      semanaUuid: a.semanaUuid ?? null,
      semanaCodigo: a.semanaCodigo ?? null,
      totalMm: a.countMm > 0 ? Math.round(a.sumaMm * 100) / 100 : null,
      promedioTemperatura: a.countTemp > 0 ? Math.round((a.sumaTemp / a.countTemp) * 100) / 100 : null,
      promedioHumedad: a.countHum > 0 ? Math.round((a.sumaHum / a.countHum) * 100) / 100 : null,
    }));

    if (query.anio) {
      items = items.filter((it) => it.anio === Number(query.anio));
    }
    items.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    return { items, aniosDisponibles, granularidad };
  },
};

export default climaService;
