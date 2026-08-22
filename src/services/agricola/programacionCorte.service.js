import { parseBulkFile } from '../../utils/bulkFileParser.js';
import { programacionCorteRepository } from '../../repositories/agricola/programacionCorte.repository.js';
import { productoRepository } from '../../repositories/agricola/producto.repository.js';
import { produccionSemanalRepository } from '../../repositories/agricola/produccionSemanal.repository.js';
import { Finca, Semana } from '../../database/associations.js';
import { sequelize } from '../../database/connection.js';
import { ApiError } from '../../utils/ApiError.js';
import { getFincaIdsPermitidas, assertFincaPermitida, expandirFincaIds } from '../../utils/fincaScope.js';
import { logger } from '../../utils/logger.js';
import { configuracionService } from '../sistema/configuracion.service.js';

// Mismo tope que produccionSemanal.service.js.
const MAX_FILAS_BULK = 15000;

// Valida las filas crudas del archivo contra los catálogos de finca/semana
// y el alcance del usuario — mismo criterio que produccionSemanal/clima.
function validarFilasProgramacion(filas, { fincaPorCodigo, semanaPorCodigo, fincaIdsPermitidas, actorId }) {
  const errores = [];
  const filasValidas = [];

  for (let i = 0; i < filas.length; i++) {
    const row = filas[i];
    const nro = i + 2;

    const fechaRaw = String(row.fecha || '').trim();
    const fincaCodigo = String(row.fincacodigo || row.finca || row.codigofinca || '').trim().toUpperCase();
    const semanaCodigo = String(row.semana || row.semanacodigo || '').trim();
    const producto = String(row.producto || row.combo || '').trim();
    // Proceso de empaque (Finca/Local/Puerto en Logística) — opcional, el
    // cargue manual no lo trae y queda ''.
    const procesoEmpaque = String(row.procesoempaque || row.proceso || '').trim();
    const cajasRaw = Number(row.cajasprogramadas || row.cajas || row.cajas20kg || 0);

    if (!fechaRaw || Number.isNaN(new Date(fechaRaw).getTime())) {
      errores.push({ fila: nro, error: `Fecha "${row.fecha || ''}" no es válida (formato esperado: AAAA-MM-DD)` });
      continue;
    }
    if (!fincaCodigo) {
      errores.push({ fila: nro, error: 'Código de finca no proporcionado' });
      continue;
    }
    if (!semanaCodigo) {
      errores.push({ fila: nro, error: 'Semana no proporcionada' });
      continue;
    }
    if (!producto) {
      errores.push({ fila: nro, error: 'Producto no proporcionado' });
      continue;
    }

    const fincaId = fincaPorCodigo.get(fincaCodigo);
    if (!fincaId) {
      errores.push({ fila: nro, error: `Finca "${fincaCodigo}" no encontrada` });
      continue;
    }
    if (fincaIdsPermitidas !== null && !fincaIdsPermitidas.includes(fincaId)) {
      errores.push({ fila: nro, error: `No tienes acceso a la finca "${fincaCodigo}"` });
      continue;
    }

    const semanaId = semanaPorCodigo.get(semanaCodigo);
    if (!semanaId) {
      errores.push({ fila: nro, error: `Semana "${semanaCodigo}" no encontrada` });
      continue;
    }

    if (!Number.isFinite(cajasRaw) || cajasRaw < 0) {
      errores.push({ fila: nro, error: `Cajas programadas "${row.cajasprogramadas || ''}" no es un número válido` });
      continue;
    }

    const fecha = new Date(fechaRaw).toISOString().slice(0, 10);
    filasValidas.push({
      fecha, fincaId, semanaId, producto, procesoEmpaque,
      cajasProgramadas: Math.round(cajasRaw), createdBy: actorId,
    });
  }

  return { filasValidas, errores };
}

// Antes, dos filas con la misma fecha+finca+producto (ej. una parte
// cortada se empaca en la Finca y otra en Local, mismo día) se trataban
// como "duplicado" y se descartaba una — perdiendo cajas reales. Ahora se
// diferencian por proceso de empaque, y si aun así coinciden (dos filas del
// mismo lote con la misma clave completa) se SUMAN en vez de descartarse.
function agruparYSumarCajas(filas) {
  const porClave = new Map();
  for (const f of filas) {
    const clave = `${f.fecha}|${f.fincaId}|${f.productoId}|${f.procesoEmpaque}`;
    const existente = porClave.get(clave);
    if (existente) {
      existente.cajasProgramadas += f.cajasProgramadas;
    } else {
      porClave.set(clave, { ...f });
    }
  }
  return [...porClave.values()];
}

export async function cargarCatalogos() {
  const [todasFincas, todasSemanas] = await Promise.all([
    Finca.findAll({ attributes: ['id', 'codigo'] }),
    Semana.findAll({ attributes: ['id', 'codigo', 'anio', 'numeroSemana'] }),
  ]);
  return {
    fincaPorCodigo: new Map(todasFincas.map((f) => [f.codigo, f.id])),
    semanaPorCodigo: new Map(todasSemanas.map((s) => [s.codigo, s.id])),
  };
}

// A diferencia de finca/semana (catálogos cerrados, hay que sincronizarlos a
// mano antes), el producto se autocrea la primera vez que aparece en un
// cargue o sincronización — es solo una etiqueta, no tiene permisos ni
// alcance asociado, así que no vale la pena exigir un paso manual previo.
export async function resolverProductosPorNombre(nombres, actorId) {
  const todos = await productoRepository.findAll();
  const porNombre = new Map(todos.map((p) => [p.nombre, p.id]));

  for (const nombre of nombres) {
    if (porNombre.has(nombre)) continue;
    const creado = await productoRepository.create({ nombre, createdBy: actorId });
    porNombre.set(nombre, creado.id);
  }

  return porNombre;
}

// Valida + descarta duplicados (contra la BD y dentro del mismo lote) +
// inserta — compartido entre el cargue manual (bulkCreateProgramacion, filas
// ya parseadas de un archivo) y la sincronización con Logística
// (syncFromBanarica, filas ya normalizadas al mismo shape crudo).
async function procesarFilas(filas, actorId, user) {
  const fincaIdsPermitidas = getFincaIdsPermitidas(user);
  const { fincaPorCodigo, semanaPorCodigo } = await cargarCatalogos();
  const { filasValidas, errores } = validarFilasProgramacion(filas, {
    fincaPorCodigo,
    semanaPorCodigo,
    fincaIdsPermitidas,
    actorId,
  });

  if (filasValidas.length === 0) {
    return { totalFilas: filas.length, creados: 0, errores };
  }

  const nombresProducto = [...new Set(filasValidas.map((f) => f.producto))];
  const productoPorNombre = await resolverProductosPorNombre(nombresProducto, actorId);
  for (const f of filasValidas) {
    f.productoId = productoPorNombre.get(f.producto);
    delete f.producto;
  }

  const fechas = [...new Set(filasValidas.map((f) => f.fecha))];
  const fincaIds = [...new Set(filasValidas.map((f) => f.fincaId))];
  const existentes = await programacionCorteRepository.findAllByFechaYFinca({ fechas, fincaIds });
  const existenteSet = new Set(
    existentes.map((e) => `${e.fecha}|${e.fincaId}|${e.productoId}|${e.procesoEmpaque}`),
  );

  // Primero suma cajas de filas del mismo lote que comparten fecha+finca+
  // producto+proceso (ver agruparYSumarCajas), y solo después descarta las
  // que ya existan en la base (mismo criterio que produccionSemanal).
  const filasAgrupadas = agruparYSumarCajas(filasValidas);
  const aInsertar = [];
  for (const f of filasAgrupadas) {
    const clave = `${f.fecha}|${f.fincaId}|${f.productoId}|${f.procesoEmpaque}`;
    if (existenteSet.has(clave)) continue;
    existenteSet.add(clave);
    aInsertar.push(f);
  }
  const saltados = filasAgrupadas.length - aInsertar.length;

  if (aInsertar.length > 0) {
    await programacionCorteRepository.bulkCreate(aInsertar);
    await actualizarPrimeraSemanaSiAplica([...new Set(aInsertar.map((f) => f.semanaId))]);
  }

  await recalcularProduccionSemanal(
    [...new Set(aInsertar.map((f) => `${f.fincaId}-${f.semanaId}`))].map((clave) => {
      const [fincaId, semanaId] = clave.split('-').map(Number);
      return { fincaId, semanaId };
    }),
    actorId,
  );

  return {
    totalFilas: filas.length,
    creados: aInsertar.length,
    saltados,
    errores: errores.length > 0 ? errores : undefined,
  };
}

// Recalcula Producción Semanal (cajas de 20kg) para los pares finca+semana
// dados, a partir de las cajas que haya ahora mismo en Programación de Corte
// — una sola consulta SQL agregada (sumarPesoPorFincaYSemana) más un único
// bulkUpsert, sin importar cuántas filas de Programación de Corte existan.
// Si un par ya no tiene ninguna caja programada, se borra su registro
// calculado en vez de dejar un valor viejo dando vueltas.
async function recalcularProduccionSemanal(pares, actorId) {
  if (!pares || pares.length === 0) return;

  const tasa = await configuracionService.getTasaConversion();
  const totales = await Promise.all(
    pares.map(({ fincaId, semanaId }) => programacionCorteRepository.sumarPesoPorFincaYSemana({ fincaId, semanaId })),
  );

  const aGuardar = [];
  const aBorrar = [];
  totales.flat().forEach((t) => {
    const totalPeso = Number(t.totalPeso) || 0;
    if (totalPeso > 0) {
      aGuardar.push({
        fincaId: t.fincaId,
        semanaId: t.semanaId,
        cajas20kg: Math.round(totalPeso / tasa),
        createdBy: actorId,
        updatedBy: actorId,
      });
    } else {
      aBorrar.push({ fincaId: t.fincaId, semanaId: t.semanaId });
    }
  });

  // Pares sin ninguna fila en programacion_corte (sumarPesoPorFincaYSemana
  // no los devuelve porque el LEFT JOIN no tiene nada que agrupar) también
  // deben borrarse si tenían un cálculo previo.
  const paresConDato = new Set(totales.flat().map((t) => `${t.fincaId}-${t.semanaId}`));
  for (const { fincaId, semanaId } of pares) {
    if (!paresConDato.has(`${fincaId}-${semanaId}`)) aBorrar.push({ fincaId, semanaId });
  }

  if (aGuardar.length > 0) await produccionSemanalRepository.bulkUpsert(aGuardar);
  for (const { fincaId, semanaId } of aBorrar) {
    await produccionSemanalRepository.deleteByFincaYSemana(fincaId, semanaId, actorId);
  }
}

// Recalcula Producción Semanal para TODA la historia de Programación de
// Corte — usado al cambiar la tasa de conversión (afecta todo el cálculo) y
// por el cron diario (para que el corte "solo hasta ayer" avance solo, ver
// programacionCorteRepository.sumarPesoPorFincaYSemana). Misma estrategia de
// una sola consulta agregada + un único bulkUpsert.
//
// CRÍTICO: solo toca semanas iguales o posteriores a la primera semana con
// Programación de Corte (mismo tracker que usa rechazoCorteService, ver
// actualizarPrimeraSemanaSiAplica) — Producción Semanal existía ANTES de
// que existiera Programación de Corte (se cargaba a mano por "Cargue
// Masivo"), así que toda esa historia previa no tiene ninguna fila de
// Programación de Corte detrás y NUNCA debe borrarse ni recalcularse acá.
async function recalcularTodaProduccionSemanal(actorId) {
  const primeraSemanaId = await configuracionService.getPrimeraSemanaProgramacionId();
  if (!primeraSemanaId) return; // Programación de Corte nunca se ha cargado: nada en alcance.
  const primeraSemana = await Semana.findByPk(primeraSemanaId, { attributes: ['anio', 'numeroSemana'] });
  if (!primeraSemana) return;

  const tasa = await configuracionService.getTasaConversion();
  const [totales, paresExistentes] = await Promise.all([
    programacionCorteRepository.sumarPesoPorFincaYSemana(),
    produccionSemanalRepository.findTodosLosPares(),
  ]);

  const conDato = new Set();
  const aGuardar = [];
  for (const t of totales) {
    if (Number(t.totalPeso) <= 0) continue;
    conDato.add(`${t.fincaId}-${t.semanaId}`);
    aGuardar.push({
      fincaId: t.fincaId,
      semanaId: t.semanaId,
      cajas20kg: Math.round(Number(t.totalPeso) / tasa),
      createdBy: actorId,
      updatedBy: actorId,
    });
  }

  if (aGuardar.length > 0) await produccionSemanalRepository.bulkUpsert(aGuardar);

  // Pares dentro del alcance (semana >= primera con Programación de Corte)
  // que hoy tienen un cálculo guardado pero ya no tienen ninguna caja que
  // contar (ej. tras excluir días futuros) — se borran en vez de dejarlos
  // con un valor viejo dando vueltas. Los de fuera de alcance (historia
  // previa a Programación de Corte) se ignoran por completo.
  const semanaIdsAConsiderar = [...new Set(paresExistentes.map((p) => p.semanaId))]
    .filter((id) => id !== primeraSemanaId);
  const semanasInfo = semanaIdsAConsiderar.length > 0
    ? await Semana.findAll({ where: { id: semanaIdsAConsiderar }, attributes: ['id', 'anio', 'numeroSemana'] })
    : [];
  const semanaEnAlcance = new Map(semanasInfo.map((s) => [s.id, !esSemanaAnterior(s, primeraSemana)]));
  semanaEnAlcance.set(primeraSemanaId, true);

  const aBorrar = paresExistentes.filter((par) => {
    if (conDato.has(`${par.fincaId}-${par.semanaId}`)) return false;
    return semanaEnAlcance.get(par.semanaId) === true;
  });
  if (aBorrar.length > 0) await produccionSemanalRepository.deleteMuchosPares(aBorrar, actorId);
}

// Reemplaza TODA la programación de una semana: borra lo que ya había
// (sin importar su origen — cargue manual o sincronización previa) y
// vuelve a montarla desde cero con lo que trae Logística ahora — mismo
// criterio que usa Logística internamente al cargar su propio Excel
// (borra los registros de los embarques de esa semana y crea los nuevos).
// A diferencia de procesarFilas (que se usa para el cargue manual y omite
// duplicados), acá no tiene sentido "omitir": si Logística ya no tiene una
// fila que antes sí tenía, la sincronización debe reflejar eso.
async function reemplazarFilasSemana(filas, actorId, user, semanaId) {
  const fincaIdsPermitidas = getFincaIdsPermitidas(user);
  const { fincaPorCodigo, semanaPorCodigo } = await cargarCatalogos();
  const { filasValidas, errores } = validarFilasProgramacion(filas, {
    fincaPorCodigo,
    semanaPorCodigo,
    fincaIdsPermitidas,
    actorId,
  });

  if (filasValidas.length === 0) {
    return { totalFilas: filas.length, creados: 0, borrados: 0, errores };
  }

  const nombresProducto = [...new Set(filasValidas.map((f) => f.producto))];
  const productoPorNombre = await resolverProductosPorNombre(nombresProducto, actorId);
  for (const f of filasValidas) {
    f.productoId = productoPorNombre.get(f.producto);
    delete f.producto;
  }

  // Suma cajas de filas con la misma fecha+finca+producto+proceso repetida
  // en la respuesta de Logística (ver agruparYSumarCajas) — antes se
  // descartaba la repetida entera, perdiendo esas cajas.
  const aInsertar = agruparYSumarCajas(filasValidas);

  const borrados = await sequelize.transaction(async (transaction) => {
    const cantidadBorrados = await programacionCorteRepository.deleteBySemana(semanaId, { transaction });
    if (aInsertar.length > 0) {
      await programacionCorteRepository.bulkCreate(aInsertar, { transaction });
    }
    return cantidadBorrados;
  });

  if (aInsertar.length > 0) await actualizarPrimeraSemanaSiAplica([semanaId]);

  // Recalcula todas las fincas de esta semana: las que tienen filas nuevas
  // (aInsertar) Y las que tenían un cálculo previo pero se quedaron sin
  // ninguna fila tras el reemplazo (para no dejar un valor viejo).
  const previos = await produccionSemanalRepository.findAllBySemanaYFinca({
    semanaIds: [semanaId],
    fincaIds: [...new Set(filasValidas.map((f) => f.fincaId))],
  });
  const fincasAfectadas = new Set([
    ...aInsertar.map((f) => f.fincaId),
    ...previos.map((p) => p.fincaId),
  ]);
  await recalcularProduccionSemanal(
    [...fincasAfectadas].map((fincaId) => ({ fincaId, semanaId })),
    actorId,
  );

  return {
    totalFilas: filas.length,
    creados: aInsertar.length,
    borrados,
    errores: errores.length > 0 ? errores : undefined,
  };
}

// true si `a` es cronológicamente anterior a `b`, comparando por semana
// (año + número de semana), no por fecha_inicio — así queda consistente
// con cómo se identifican las semanas en todo el sistema (código
// "S33-2026"), sin depender de que fecha_inicio esté bien calculada.
export function esSemanaAnterior(a, b) {
  if (a.anio !== b.anio) return a.anio < b.anio;
  return a.numeroSemana < b.numeroSemana;
}

// Mantiene actualizado el "primera semana con Programación de Corte" que
// usa rechazoCorteService para decidir si un aviso de Rechazos de una
// semana vieja debe ignorarse (semanas anteriores a que Corbana empezara a
// hacer este seguimiento).
async function actualizarPrimeraSemanaSiAplica(semanaIds) {
  if (!semanaIds || semanaIds.length === 0) return;

  const semanas = await Semana.findAll({ where: { id: semanaIds }, attributes: ['id', 'anio', 'numeroSemana'] });
  if (semanas.length === 0) return;

  const primeraActualId = await configuracionService.getPrimeraSemanaProgramacionId();
  const primeraActual = primeraActualId
    ? await Semana.findByPk(primeraActualId, { attributes: ['id', 'anio', 'numeroSemana'] })
    : null;

  let candidata = primeraActual;
  for (const semana of semanas) {
    if (!candidata || esSemanaAnterior(semana, candidata)) candidata = semana;
  }

  if (!primeraActual || candidata.id !== primeraActual.id) {
    await configuracionService.setPrimeraSemanaProgramacionId(candidata.id, null);
  }
}

// Trae toda la Programación de Corte cargada en Logística, con Embarque
// (semana) y almacén (finca) ya incluidos — ver
// api-rest-banarica/services/logistica/programacionCorte.service.js#listar.
// Autenticado con la API key guardada en Conexión con Logística (header
// `api`, ver checkApiKeyOrJwt en api-rest-banarica), no con usuario/clave.
async function fetchProgramacionCorteLogistica() {
  const [baseUrl, apiKey] = await Promise.all([
    configuracionService.getBanaricaApiUrl(),
    configuracionService.getBanaricaApiKey(),
  ]);
  if (!apiKey) {
    throw ApiError.badRequest('Configura la API key de Logística en Conexión con Logística antes de sincronizar');
  }

  let filas;
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/v1/programacion-corte`, {
      headers: { api: apiKey },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    filas = await response.json();
  } catch (error) {
    logger.error('Error al consultar programación de corte de Logística', { message: error.message });
    throw ApiError.internal('No se pudo consultar el API de Logística para sincronizar la programación de corte');
  }
  if (!Array.isArray(filas)) throw ApiError.internal('Respuesta inesperada del API de Logística al listar programación de corte');
  return filas;
}

// Le pide a Logística que reenvíe los Rechazos de esa semana (best-effort,
// nunca bloquea ni hace fallar la sincronización de Programación de Corte)
// — así "Sincronizar" trae ambas cosas de una, sin depender de que alguien
// edite un rechazo en Banarica para que se entere Corbana (ver
// rechazoCorteService.syncSemanaWebhook y RechazoService#backfillSemana en
// api-rest-banarica).
async function pedirBackfillRechazosBanarica(semanaCodigo) {
  const [baseUrl, apiKey] = await Promise.all([
    configuracionService.getBanaricaApiUrl(),
    configuracionService.getBanaricaApiKey(),
  ]);
  if (!apiKey) return;

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/v1/rechazos/backfill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', api: apiKey },
    body: JSON.stringify({ semana: semanaCodigo }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}

export const programacionCorteService = {
  async listProgramacion(query, user) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const offset = (page - 1) * limit;

    const fincaId = query.fincaUuid
      ? (await Finca.findOne({ where: { uuid: query.fincaUuid } }))?.id
      : undefined;
    if (fincaId) assertFincaPermitida(user, fincaId);
    const fincaIds = fincaId ? await expandirFincaIds([fincaId]) : getFincaIdsPermitidas(user);
    const semanaId = query.semanaUuid
      ? (await Semana.findOne({ where: { uuid: query.semanaUuid } }))?.id
      : undefined;

    const { rows, count } = await programacionCorteRepository.findAndCountAll({
      limit, offset, fincaId, fincaIds, semanaId,
      fechaDesde: query.fechaDesde || undefined,
      fechaHasta: query.fechaHasta || undefined,
    });

    return {
      items: rows,
      page, limit, total: count, totalPages: Math.ceil(count / limit),
    };
  },

  async bulkCreateProgramacion(file, actorId, user) {
    const filas = parseBulkFile(file);
    if (filas.length === 0) throw ApiError.badRequest('El archivo está vacío');

    if (filas.length > MAX_FILAS_BULK) {
      throw ApiError.badRequest(
        `El archivo tiene ${filas.length.toLocaleString('es')} filas — el máximo por cargue es ${MAX_FILAS_BULK.toLocaleString('es')}. ` +
          'Dividilo en partes más chicas (por ejemplo, por semana) y subilas una por una.',
      );
    }

    return procesarFilas(filas, actorId, user);
  },

  // Sincroniza la Programación de Corte cargada en Logística (Banarica) de
  // UNA sola semana (obligatoria) — trae todos los registros de Logística
  // (esa API no filtra por semana), descarta acá los que no sean de la
  // semana pedida, y REEMPLAZA por completo lo que Corbana tenía guardado
  // de esa semana (borra + vuelve a montar) para que quede igual a lo que
  // hay en Logística ahora mismo, sin arrastrar filas viejas que allá ya se
  // borraron o cambiaron. `almacen.consecutivo` es exactamente el mismo
  // código que quedó guardado como `finca.codigo` al sincronizar fincas
  // desde Logística (ver fincaService.syncFromBanarica), así que no hace
  // falta ningún mapeo por nombre.
  async syncFromBanarica(actorId, user, semanaUuid) {
    if (!semanaUuid) throw ApiError.badRequest('Debes indicar la semana a sincronizar');
    const semana = await Semana.findOne({ where: { uuid: semanaUuid } });
    if (!semana) throw ApiError.notFound('Semana no encontrada');

    const filasLogistica = await fetchProgramacionCorteLogistica();

    const filas = filasLogistica
      .filter((r) => r.Embarque?.semana?.consecutivo === semana.codigo)
      .map((r) => ({
        fecha: r.fecha,
        fincacodigo: r.almacen?.consecutivo ?? '',
        semana: r.Embarque?.semana?.consecutivo ?? '',
        producto: r.combo?.nombre ?? '',
        procesoempaque: r.proceso_empaque ?? '',
        cajasprogramadas: r.cajas,
      }));

    pedirBackfillRechazosBanarica(semana.codigo).catch((error) => {
      logger.error('No se pudo pedir a Logística el backfill de Rechazos', { message: error.message, semana: semana.codigo });
    });

    if (filas.length === 0) {
      return { totalFilas: 0, creados: 0, borrados: 0, errores: undefined };
    }

    return reemplazarFilasSemana(filas, actorId, user, semana.id);
  },

  // Igual que syncFromBanarica, pero llamado por el propio api-rest-banarica
  // (webhook, ver requireApiKey.middleware.js) justo después de que alguien
  // carga ahí su Excel de Programación de Corte — así Corbana queda al día
  // sin que nadie tenga que apretar "Sincronizar" a mano. Recibe el código
  // de semana tal cual (no un uuid, Banarica no conoce los uuids de Corbana)
  // y no hay `user` (no hay sesión humana detrás), así que no hay alcance de
  // fincas que restrinja nada.
  async syncSemanaWebhook(semanaCodigo) {
    if (!semanaCodigo) throw ApiError.badRequest('Debes indicar la semana a sincronizar');
    const semana = await Semana.findOne({ where: { codigo: semanaCodigo } });
    if (!semana) throw ApiError.notFound(`Semana "${semanaCodigo}" no encontrada en Corbana`);

    const filasLogistica = await fetchProgramacionCorteLogistica();

    const filas = filasLogistica
      .filter((r) => r.Embarque?.semana?.consecutivo === semana.codigo)
      .map((r) => ({
        fecha: r.fecha,
        fincacodigo: r.almacen?.consecutivo ?? '',
        semana: r.Embarque?.semana?.consecutivo ?? '',
        producto: r.combo?.nombre ?? '',
        procesoempaque: r.proceso_empaque ?? '',
        cajasprogramadas: r.cajas,
      }));

    if (filas.length === 0) {
      return { totalFilas: 0, creados: 0, borrados: 0, errores: undefined };
    }

    return reemplazarFilasSemana(filas, null, null, semana.id);
  },

  async getProgramacionByUuid(uuid, user) {
    const registro = await programacionCorteRepository.findByUuid(uuid);
    if (!registro) throw ApiError.notFound('Registro de programación no encontrado');
    assertFincaPermitida(user, registro.fincaId);
    return registro;
  },

  async deleteProgramacion(uuid, actorId, user) {
    const registro = await this.getProgramacionByUuid(uuid, user);
    await programacionCorteRepository.softDelete(registro, actorId);
    await recalcularProduccionSemanal([{ fincaId: registro.fincaId, semanaId: registro.semanaId }], actorId);
  },

  // Llamado desde configuracion.controller.js cuando el admin cambia la
  // tasa de conversión guardada — recalcula toda la historia con la tasa
  // nueva (ver recalcularTodaProduccionSemanal).
  recalcularTodaProduccionSemanal,
};

export default programacionCorteService;
