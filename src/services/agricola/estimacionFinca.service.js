import { Op } from 'sequelize';
import { estimacionFincaRepository } from '../../repositories/agricola/estimacionFinca.repository.js';
import { produccionSemanalRepository } from '../../repositories/agricola/produccionSemanal.repository.js';
import { racimoMovimientoRepository } from '../../repositories/agricola/racimoMovimiento.repository.js';
import { semanaRepository } from '../../repositories/agricola/semana.repository.js';
import { Finca, Semana, User, RacimoMovimiento, FincaSemanaLiquidacion } from '../../database/associations.js';
import { sequelize } from '../../database/connection.js';
import { ApiError } from '../../utils/ApiError.js';
import { getFincaIdsPermitidas, assertFincaPermitida, expandirFincaIds } from '../../utils/fincaScope.js';
import { configuracionService } from '../sistema/configuracion.service.js';
import { parseBulkFile } from '../../utils/bulkFileParser.js';
import { ROLES } from '../../constants/roles.constants.js';

const SEMANAS_DEFAULT = 8;
const MAX_ITEMS = 1000;
const MAX_FILAS_BULK = 15000;

// Ver comentario extenso en pronostico.service.js: la política de la empresa
// solo permite cortar hasta las 12 semanas de edad — edad 13+ es casi
// inexistente en la práctica (~0.01% histórico). CINTA_EDADES no es una
// proyección: es el estado REAL, histórico, de los embolses de la finca que
// ya alcanzaron esas edades (si aparece algo ahí, es atraso de corte real o
// un error de captura — vale la pena revisarlo).
const CINTA_EDADES = [13, 14, 15, 16, 17];
// Patrón de corte: % de lo cosechado en una semana que correspondió a cada
// edad (ventana normal de la empresa, 8-12).
const PATRON_CORTE_EDADES = [8, 9, 10, 11, 12];
const PATRON_CORTE_EDAD_REFERENCIA = 12;
// Cuántas semanas LIQUIDADAS mostrar (una fila por semana liquidada, no por
// semana de calendario).
const PATRON_CORTE_FILAS = 5;

function validarFilasEstimaciones(filas, { fincaPorCodigo, semanaPorCodigo, semanasOrdenadas, fincaIdsPermitidas }) {
  const errores = [];
  const filasValidas = [];

  // Mapa rápido código -> índice en semanasOrdenadas para resolver "próximas 8"
  const indiceSemanaPorCodigo = new Map();
  semanasOrdenadas.forEach((s, idx) => indiceSemanaPorCodigo.set(s.codigo, idx));

  for (let i = 0; i < filas.length; i++) {
    const row = filas[i];
    const nro = i + 2;

    // Detectar formato ancho: "Codigo finca" + "Semana registro" + "Semana 1".."Semana 8"
    const tieneAncho =
      'semanaregistro' in row ||
      'codigofinca' in row ||
      'semana1' in row ||
      'semana2' in row;

    // Si tiene semana registro, es ancho aunque venga con otro nombre
    const esAncho = tieneAncho && ('semanaregistro' in row || 'semana1' in row);

    if (esAncho) {
      const fincaCodigo = String(row.codigofinca || row.fincacodigo || row.codigoFinca || row.codigofinca || row.finca || '').trim().toUpperCase();
      // "Semana registro" normalizada -> semanaregistro
      const semanaRegistroCodigo = String(
        row.semanaregistro || row.semanaregistrocodigo || row.registro || row.semanareg || '',
      ).trim();
      if (!fincaCodigo) {
        errores.push({ fila: nro, error: 'Código de finca no proporcionado' });
        continue;
      }
      if (!semanaRegistroCodigo) {
        errores.push({ fila: nro, error: 'Semana registro no proporcionada' });
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
      const idxRegistro = indiceSemanaPorCodigo.get(semanaRegistroCodigo);
      if (idxRegistro === undefined) {
        errores.push({ fila: nro, error: `Semana registro "${semanaRegistroCodigo}" no encontrada` });
        continue;
      }
      // Las 8 semanas siguientes a la de registro (mismo criterio que el
      // formulario: S36-2026 -> S37..S44). Si el calendario no llega tan lejos,
      // se reporta fila con error para esas semanas.
      const siguientes = semanasOrdenadas.slice(idxRegistro + 1, idxRegistro + 9);
      const semanaRegistroId = semanasOrdenadas[idxRegistro].id;
      let filasEnEstaFila = 0;
      for (let k = 1; k <= 8; k++) {
        const key = `semana${k}`;
        if (!(key in row)) continue;
        const raw = row[key];
        if (raw === '' || raw === null || raw === undefined) continue;
        const cajasRaw = Number(raw);
        if (!Number.isFinite(cajasRaw) || cajasRaw < 0) {
          errores.push({ fila: nro, error: `Semana ${k} — cajas "${raw}" no es un número válido` });
          continue;
        }
        const target = siguientes[k - 1];
        if (!target) {
          errores.push({
            fila: nro,
            error: `Semana ${k} no existe en el calendario (a partir de ${semanaRegistroCodigo} solo hay ${siguientes.length} semana(s) cargadas). Genera el calendario del año siguiente.`,
          });
          continue;
        }
        filasValidas.push({ semanaId: target.id, semanaRegistroId, fincaId, cajas20kg: Math.round(cajasRaw * 100) / 100 });
        filasEnEstaFila += 1;
      }
      if (filasEnEstaFila === 0) {
        errores.push({ fila: nro, error: 'Ninguna de Semana 1..8 tiene un valor de cajas válido' });
      }
      continue;
    }

    // Formato largo legacy: una fila por finca+semana objetivo
    const semanaCodigo = String(row.semana || row.semanacodigo || row.codigo || '').trim();
    const fincaCodigo = String(row.fincacodigo || row.finca || row.codigofinca || '').trim().toUpperCase();
    const cajasRaw = Number(row.cajas ?? row.cajas20kg ?? row.cajas_20kg ?? row.cajasproducidas ?? row.cajasestimadas ?? '');
    if (!semanaCodigo) {
      errores.push({ fila: nro, error: 'Semana no proporcionada' });
      continue;
    }
    if (!fincaCodigo) {
      errores.push({ fila: nro, error: 'Código de finca no proporcionado' });
      continue;
    }
    const semanaId = semanaPorCodigo.get(semanaCodigo);
    if (!semanaId) {
      errores.push({ fila: nro, error: `Semana "${semanaCodigo}" no encontrada` });
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
    if (!Number.isFinite(cajasRaw) || cajasRaw < 0) {
      errores.push({ fila: nro, error: `Cajas "${row.cajas ?? row.cajas20kg ?? ''}" no es un número válido` });
      continue;
    }
    // El cargue masivo histórico permite semanas pasadas, a diferencia del
    // formulario puntual que solo deja estimar semanas futuras.
    const idxTarget = indiceSemanaPorCodigo.get(semanaCodigo);
    const semanaRegistroIdLegacy = idxTarget !== undefined && idxTarget > 0 ? semanasOrdenadas[idxTarget - 1].id : semanasOrdenadas[idxTarget]?.id;
    filasValidas.push({ semanaId, semanaRegistroId: semanaRegistroIdLegacy, fincaId, cajas20kg: Math.round(Number(cajasRaw) * 100) / 100 });
  }
  return { filasValidas, errores };
}

async function cargarCatalogosEstimaciones() {
  const [todasFincas, todasSemanas] = await Promise.all([
    Finca.findAll({ attributes: ['id', 'codigo'] }),
    Semana.findAll({ attributes: ['id', 'codigo', 'fechaInicio', 'fechaFin'], order: [['fecha_inicio', 'ASC']] }),
  ]);
  return {
    fincaPorCodigo: new Map(todasFincas.map((f) => [f.codigo, f.id])),
    semanaPorCodigo: new Map(todasSemanas.map((s) => [s.codigo, s.id])),
    semanasOrdenadas: todasSemanas,
  };
}

// El usuario solo puede estimar fincas que tenga habilitadas. Cuando está
// restringido (getFincaIdsPermitidas ≠ null) también solo ve SUS propias
// estimaciones; un Administrador (o alguien sin fincas asignadas) ve todo.
function resolverVisibilidad(user) {
  const fincaIds = getFincaIdsPermitidas(user);
  const soloPropias = fincaIds !== null;
  return { fincaIds, soloPropias };
}

// Estado real (histórico, no proyectado) de las cintas de embolse de una
// finca que HOY tienen cada una de las edades dadas — una por edad, porque
// la edad determina una única semana de embolse relativa a `currentIdx`.
async function getCintasPorEdad(fincaId, currentIdx, semanasAll, edades) {
  const edadMax = edades[edades.length - 1];
  const edadMin = edades[0];
  const embolseIdxMin = Math.max(currentIdx - edadMax + 1, 0);
  const embolseIdxMax = currentIdx - edadMin + 1;
  const semanaEmbolseIds = embolseIdxMax >= 0 ? semanasAll.slice(embolseIdxMin, embolseIdxMax + 1).map((s) => s.id) : [];

  const movimientos = semanaEmbolseIds.length
    ? await RacimoMovimiento.findAll({
        where: { fincaId, semanaEmbolseId: { [Op.in]: semanaEmbolseIds } },
        attributes: ['semanaEmbolseId', 'tipo', 'cantidad'],
      })
    : [];

  const porEmbolse = new Map();
  for (const m of movimientos) {
    if (!porEmbolse.has(m.semanaEmbolseId)) {
      porEmbolse.set(m.semanaEmbolseId, { embolsado: 0, repicado: 0, recusado: 0, procesado: 0 });
    }
    const acc = porEmbolse.get(m.semanaEmbolseId);
    if (m.tipo === 'EMBOLSE') acc.embolsado += m.cantidad;
    else if (m.tipo === 'REPIQUE') acc.repicado += m.cantidad;
    else if (m.tipo === 'RECUSE') acc.recusado += m.cantidad;
    else if (m.tipo === 'PROCESADO') acc.procesado += m.cantidad;
  }

  return edades.map((edad) => {
    const embolseIdx = currentIdx - edad + 1;
    const semanaEmbolse = embolseIdx >= 0 ? semanasAll[embolseIdx] : null;
    const acc = semanaEmbolse ? porEmbolse.get(semanaEmbolse.id) : null;
    const embolsado = acc?.embolsado || 0;
    const repicado = acc?.repicado || 0;
    const recusado = acc?.recusado || 0;
    const procesado = acc?.procesado || 0;
    return {
      edad,
      semanaEmbolse: semanaEmbolse ? { uuid: semanaEmbolse.uuid, codigo: semanaEmbolse.codigo } : null,
      embolsado,
      procesado,
      repicado,
      recusado,
      saldo: embolsado - repicado - recusado - procesado,
    };
  });
}

export const estimacionFincaService = {
  // Lista las próximas semanas a estimar (empezando la semana DESPUÉS de la
  // actual) junto con la tasa de conversión de cajas que se aplica.
  async getSemanasAEstimar(query, user) {
    const n = Number(query.semanas) || SEMANAS_DEFAULT;
    const hoy = new Date().toISOString().slice(0, 10);

    const semanaActual = await semanaRepository.findByFecha(hoy);
    // Quién ve qué fincas en el formulario de carga.
    const { fincaIds } = resolverVisibilidad(user);
    const fincaWhere = fincaIds ? { id: { [Op.in]: fincaIds } } : {};
    const fincas = await Finca.findAll({
      where: { ...fincaWhere, estado: true },
      attributes: ['id', 'uuid', 'codigo', 'nombre'],
      order: [['codigo', 'ASC']],
    });

    if (!semanaActual) {
      return { semanas: [], fincas, tasaConversion: await configuracionService.getTasaConversion(), calendarioIncompleto: true };
    }

    // Las `n` semanas siguientes a la actual (no la incluye): si hoy estamos
    // en S36-2026, se estima S37..S44 según el rango solicitado.
    const inicioProx = await Semana.findOne({
      where: { fechaInicio: { [Op.gt]: semanaActual.fechaInicio } },
      order: [['fecha_inicio', 'ASC']],
    });
    if (!inicioProx) {
      return { semanas: [], fincas, tasaConversion: await configuracionService.getTasaConversion(), calendarioIncompleto: true };
    }

    const semanas = await Semana.findAll({
      where: { fechaInicio: { [Op.gte]: inicioProx.fechaInicio } },
      order: [['fecha_inicio', 'ASC']],
      limit: n,
      attributes: ['id', 'uuid', 'codigo', 'numeroSemana', 'anio'],
    });

    return {
      semanas,
      fincas,
      semanaActual,
      tasaConversion: await configuracionService.getTasaConversion(),
      calendarioIncompleto: semanas.length < n,
    };
  },

  // Guarda (upsert) las estimaciones de las fincas habilitadas para este
  // usuario. Se valida que todas las finca+semana pertenezcan al usuario y a
  // las semanas permitidas (posteriores a la actual).
  async guardarEstimaciones(body, actorId, user) {
    const items = body.items || [];
    if (items.length === 0) throw ApiError.badRequest('No hay estimaciones para guardar');
    if (items.length > MAX_ITEMS) {
      throw ApiError.badRequest(`Demasiadas filas: el máximo por guardado es ${MAX_ITEMS}.`);
    }

    const { fincaIds: fincaIdsPermitidas } = resolverVisibilidad(user);

    const fincaUuids = [...new Set(items.map((i) => i.fincaUuid))];
    const semanaUuids = [...new Set(items.map((i) => i.semanaUuid))];

    const [fincas, semanas, hoy] = await Promise.all([
      fincaUuids.length ? Finca.findAll({ where: { uuid: { [Op.in]: fincaUuids } } }) : [],
      semanaUuids.length ? Semana.findAll({ where: { uuid: { [Op.in]: semanaUuids } } }) : [],
      Promise.resolve(new Date().toISOString().slice(0, 10)),
    ]);

    const fincaPorUuid = new Map(fincas.map((f) => [f.uuid, f]));
    const semanaPorUuid = new Map(semanas.map((s) => [s.uuid, s]));

    const semanaActual = await semanaRepository.findByFecha(hoy);

    const errores = [];
    const filas = [];
    const vistos = new Set();
    const semanaRegistroId = semanaActual?.id || null;

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const nroFila = i + 1;

      const finca = fincaPorUuid.get(it.fincaUuid);
      if (!finca) {
        errores.push({ fila: nroFila, error: `Finca "${it.fincaUuid}" no encontrada` });
        continue;
      }
      if (fincaIdsPermitidas !== null && !fincaIdsPermitidas.includes(finca.id)) {
        errores.push({ fila: nroFila, error: `No tienes acceso a la finca "${finca.nombre}"` });
        continue;
      }

      const semana = semanaPorUuid.get(it.semanaUuid);
      if (!semana) {
        errores.push({ fila: nroFila, error: 'Semana no encontrada' });
        continue;
      }
      // Solo se pueden estimar semanas posteriores a la actual.
      if (semanaActual && new Date(semana.fechaInicio) <= new Date(semanaActual.fechaInicio)) {
        errores.push({ fila: nroFila, error: `La semana ${semana.codigo} ya inició o está en curso — no se puede estimar` });
        continue;
      }
      if (!semanaRegistroId) {
        errores.push({ fila: nroFila, error: 'No se pudo determinar la semana de registro (calendario incompleto)' });
        continue;
      }

      if (it.cajas20kg === null || it.cajas20kg === undefined || Number.isNaN(Number(it.cajas20kg)) || Number(it.cajas20kg) < 0) {
        errores.push({ fila: nroFila, error: '"cajas20kg" no es un número válido' });
        continue;
      }

      const clave = `${semana.id}-${finca.id}-${semanaRegistroId}`;
      if (vistos.has(clave)) {
        errores.push({ fila: nroFila, error: `La finca "${finca.nombre}" está duplicada para la semana ${semana.codigo}` });
        continue;
      }
      vistos.add(clave);

      filas.push({ semanaId: semana.id, fincaId: finca.id, semanaRegistroId, cajas20kg: Math.round(Number(it.cajas20kg) * 100) / 100, createdBy: actorId, updatedBy: actorId });
    }

    if (filas.length > 0) {
      await estimacionFincaRepository.bulkUpsert(filas);
    }

    return {
      guardadas: filas.length,
      errores: errores.length > 0 ? errores : undefined,
    };
  },

  async listarEstimaciones(query, user) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const offset = (page - 1) * limit;

    const { fincaIds, soloPropias } = resolverVisibilidad(user);

    // Filtro por finca puntual, expandido a su Grupo de Finca.
    let fincaIdsFiltro = fincaIds;
    if (query.fincaUuid) {
      const finca = await Finca.findOne({ where: { uuid: query.fincaUuid } });
      if (!finca) throw ApiError.badRequest('Finca no encontrada');
      assertFincaPermitida(user, finca.id);
      fincaIdsFiltro = await expandirFincaIds([finca.id]);
    }

    let creadoPorUserId;
    // Solo un Administrador / sin restricción puede listar estimaciones de
    // otros usuarios; de lo contrario solo ve las propias.
    if (!soloPropias && query.usuarioUuid) {
      const usuario = await User.findOne({ where: { uuid: query.usuarioUuid } });
      creadoPorUserId = usuario?.id || -1;
    }

    const semanaId = query.semanaUuid
      ? (await Semana.findOne({ where: { uuid: query.semanaUuid } }))?.id
      : undefined;

    const { rows, count } = await estimacionFincaRepository.findAndCountAll({
      limit,
      offset,
      fincaIds: fincaIdsFiltro,
      semanaId,
      creadoPorUserId: creadoPorUserId ?? (soloPropias ? user.id : undefined),
    });

    return {
      items: rows,
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit),
    };
  },

  async eliminarEstimacion(uuid, actorId, user) {
    const registro = await estimacionFincaRepository.findByUuid(uuid);
    if (!registro) throw ApiError.notFound('Estimación no encontrada');

    const { fincaIds: fincaIdsPermitidas, soloPropias } = resolverVisibilidad(user);
    if (fincaIdsPermitidas !== null && !fincaIdsPermitidas.includes(registro.fincaId)) {
      throw ApiError.forbidden('No tienes acceso a esta finca');
    }
    // A un usuario restringido solo se le permite borrar sus propias filas.
    if (soloPropias && registro.createdBy !== user.id) {
      throw ApiError.forbidden('Solo puedes eliminar tus propias estimaciones');
    }

    await estimacionFincaRepository.softDelete(registro, actorId);
  },

  // Vista escalera: filas = semana de registro (cuándo se cargó la
  // estimación), columnas = semana objetivo (para qué semana se estimó).
  // Cada celda es la suma de cajas (20kg eq.) de ese cruce — respeta los
  // filtros de finca y de visibilidad del usuario.
  async getEscalera(query, user) {
    const { fincaIds, soloPropias } = resolverVisibilidad(user);

    let fincaIdsFiltro = fincaIds;
    if (query.fincaUuid) {
      const finca = await Finca.findOne({ where: { uuid: query.fincaUuid } });
      if (!finca) throw ApiError.badRequest('Finca no encontrada');
      assertFincaPermitida(user, finca.id);
      fincaIdsFiltro = await expandirFincaIds([finca.id]);
    }

    let creadoPorUserId;
    if (!soloPropias && query.usuarioUuid) {
      const usuario = await User.findOne({ where: { uuid: query.usuarioUuid } });
      creadoPorUserId = usuario?.id || -1;
    } else if (soloPropias) {
      creadoPorUserId = user.id;
    }

    const registros = await estimacionFincaRepository.findForEscalera({
      fincaIds: fincaIdsFiltro,
      creadoPorUserId,
    });

    const semanasAll = await Semana.findAll({
      order: [['fecha_inicio', 'ASC']],
      attributes: ['id', 'uuid', 'codigo', 'numeroSemana', 'anio', 'fechaInicio', 'fechaFin'],
    });
    const semanaMap = new Map(semanasAll.map((s) => [String(s.id), s]));
    const hoy = new Date().toISOString().slice(0, 10);
    const semanaActual = await semanaRepository.findByFecha(hoy);

    // Fallback para filas antiguas sin semana_registro_id (antes de la migración)
    function semanaPorFecha(dateOnly) {
      for (const s of semanasAll) {
        if (s.fechaInicio <= dateOnly && dateOnly <= s.fechaFin) return s;
      }
      let candidata = null;
      for (const s of semanasAll) {
        if (s.fechaInicio <= dateOnly) candidata = s;
        else break;
      }
      return candidata;
    }

    // Columnas = todas las semanas del año elegido (el filtro `anio`, o el
    // año vigente si no se filtra) — aunque no haya datos. Se incluye
    // también el año siguiente (si ya está generado en Maestros → Semanas)
    // para que las últimas filas del año puedan mostrar completa su ventana
    // de 8 semanas siguientes, aunque caigan en el año próximo.
    const anioVigenteBase = Number(query.anio) || semanaActual?.anio || new Date().getFullYear();
    // Si el usuario filtró explícitamente por año, se aísla ESE año nada más
    // (ni el siguiente) — no se mezcla con datos de otros años aunque
    // existan. Sin filtro, se agrega el año siguiente para completar la
    // ventana de 8 semanas de las últimas filas del año vigente.
    const anioFiltroExplicito = query.anio !== undefined && query.anio !== null && query.anio !== '';
    const aniosSiempreVisibles = anioFiltroExplicito
      ? new Set([anioVigenteBase])
      : new Set([anioVigenteBase, anioVigenteBase + 1]);
    let columnas;
    if (registros.length === 0 || anioFiltroExplicito) {
      columnas = semanasAll.filter((s) => aniosSiempreVisibles.has(s.anio));
      if (columnas.length === 0) columnas = [...semanasAll];
    } else {
      const aniosConDatos = new Set(registros.map((r) => r.semana?.anio).filter(Boolean));
      for (const anio of aniosSiempreVisibles) aniosConDatos.add(anio);
      columnas = semanasAll.filter((s) => aniosConDatos.has(s.anio));
      if (columnas.length === 0) {
        const targetMap = new Map();
        for (const r of registros) if (r.semana) targetMap.set(r.semanaId, r.semana);
        columnas = [...targetMap.values()].sort((a, b) => new Date(a.fechaInicio) - new Date(b.fechaInicio));
      } else {
        columnas.sort((a, b) => new Date(a.fechaInicio) - new Date(b.fechaInicio));
      }
    }
    const columnaOrden = new Map(columnas.map((c, i) => [String(c.id), i]));

    // Filas agrupadas por semana_registro_id (histórico). Si no existe (dato viejo), fallback a fecha.
    const filasMap = new Map();
    for (const r of registros) {
      const rawRegistroId = r.semanaRegistroId ?? r.get?.('semanaRegistroId');
      let srcSemana = rawRegistroId ? semanaMap.get(String(rawRegistroId)) : null;
      let key;
      let sourceFecha;
      if (srcSemana) {
        key = `s-${srcSemana.id}`;
        sourceFecha = srcSemana.fechaInicio;
      } else {
        const ts = r.updatedAt || r.createdAt;
        const dateOnly = ts instanceof Date ? ts.toISOString().slice(0, 10) : String(ts).slice(0, 10);
        srcSemana = semanaPorFecha(dateOnly);
        key = srcSemana ? `s-${srcSemana.id}` : `d-${dateOnly}`;
        sourceFecha = srcSemana ? srcSemana.fechaInicio : dateOnly;
      }
      if (!filasMap.has(key)) {
        filasMap.set(key, {
          sourceSemana: srcSemana
            ? { id: srcSemana.id, uuid: srcSemana.uuid, codigo: srcSemana.codigo, numeroSemana: srcSemana.numeroSemana, anio: srcSemana.anio, fechaInicio: srcSemana.fechaInicio, fechaFin: srcSemana.fechaFin }
            : null,
          sourceFecha,
          valoresMap: new Map(),
          sortKey: srcSemana ? srcSemana.fechaInicio : sourceFecha,
        });
      }
      const entry = filasMap.get(key);
      const prev = entry.valoresMap.get(String(r.semanaId)) || 0;
      entry.valoresMap.set(String(r.semanaId), prev + Number(r.cajas20kg));
    }

    // Asegurar que existan todas las filas del año elegido (aunque estén vacías)
    const semanasVigentes = semanasAll.filter((s) => s.anio === anioVigenteBase);
    const baseFilas = semanasVigentes.length ? semanasVigentes : columnas;
    for (const s of baseFilas) {
      const key = `s-${s.id}`;
      if (!filasMap.has(key)) {
        filasMap.set(key, {
          sourceSemana: { id: s.id, uuid: s.uuid, codigo: s.codigo, numeroSemana: s.numeroSemana, anio: s.anio, fechaInicio: s.fechaInicio, fechaFin: s.fechaFin },
          sourceFecha: s.fechaInicio,
          valoresMap: new Map(),
          sortKey: s.fechaInicio,
        });
      }
    }

    let filasRaw = [...filasMap.values()].sort((a, b) => String(a.sortKey).localeCompare(String(b.sortKey)));

    // Si el usuario filtró explícitamente por año, no mezclar filas (semanas
    // de registro) de otros años — filtrar por año es "solo ese año", no
    // "ese año y de paso el histórico completo".
    if (anioFiltroExplicito) {
      filasRaw = filasRaw.filter((f) => !f.sourceSemana || f.sourceSemana.anio === anioVigenteBase);
    }

    // Incluir semanas fuente que no están en columnas (por si hay datos de otro año)
    const idsEnColumnas = new Set(columnas.map((c) => String(c.id)));
    const fuentesNoEnColumnas = filasRaw.filter((f) => f.sourceSemana && !idsEnColumnas.has(String(f.sourceSemana.id))).map((f) => f.sourceSemana);
    if (fuentesNoEnColumnas.length > 0) {
      const extrasUnicas = [...new Map(fuentesNoEnColumnas.map((s) => [String(s.id), s])).values()];
      for (const s of extrasUnicas) {
        let idx = 0;
        while (idx < columnas.length && new Date(columnas[idx].fechaInicio) < new Date(s.fechaInicio)) idx += 1;
        columnas.splice(idx, 0, { id: s.id, uuid: s.uuid, codigo: s.codigo, numeroSemana: s.numeroSemana, anio: s.anio, fechaInicio: s.fechaInicio, fechaFin: s.fechaFin });
      }
      columnaOrden.clear();
      columnas.forEach((c, i) => columnaOrden.set(String(c.id), i));
    }

    const filas = filasRaw.map((f) => {
      const valores = {};
      for (const [k, v] of f.valoresMap.entries()) {
        const col = columnas.find((c) => String(c.id) === String(k));
        if (col) valores[col.uuid] = v;
      }
      return {
        sourceSemana: f.sourceSemana,
        sourceFecha: f.sourceFecha,
        valores,
      };
    });

    const columnasOut = columnas.map((c) => ({ uuid: c.uuid, codigo: c.codigo, numeroSemana: c.numeroSemana, anio: c.anio, fechaInicio: c.fechaInicio, fechaFin: c.fechaFin }));
    const semanaActualOut = semanaActual
      ? { uuid: semanaActual.uuid, codigo: semanaActual.codigo, numeroSemana: semanaActual.numeroSemana, anio: semanaActual.anio }
      : null;
    // Años disponibles para el filtro (todos los que tengan calendario generado).
    const aniosDisponibles = [...new Set(semanasAll.map((s) => s.anio))].sort((a, b) => b - a);

    return { columnas: columnasOut, filas, semanaActual: semanaActualOut, anioSeleccionado: anioVigenteBase, aniosDisponibles };
  },

  async bulkCreateEstimaciones(file, actorId, user) {
    const filas = parseBulkFile(file);
    if (filas.length === 0) throw ApiError.badRequest('El archivo está vacío');
    if (filas.length > MAX_FILAS_BULK) {
      throw ApiError.badRequest(
        `El archivo tiene ${filas.length.toLocaleString('es')} filas — el máximo por cargue es ${MAX_FILAS_BULK.toLocaleString('es')}. ` +
          'Dividilo en partes más chicas (por ejemplo, por año) y subilas una por una.',
      );
    }
    const fincaIdsPermitidas = getFincaIdsPermitidas(user);
    const { fincaPorCodigo, semanaPorCodigo, semanasOrdenadas } = await cargarCatalogosEstimaciones();
    const { filasValidas, errores } = validarFilasEstimaciones(filas, {
      fincaPorCodigo,
      semanaPorCodigo,
      semanasOrdenadas,
      fincaIdsPermitidas,
    });
    if (filasValidas.length === 0) {
      return { totalFilas: filas.length, creados: 0, errores };
    }
    // Existentes del mismo usuario — clave única ahora incluye semana_registro_id
    const semanaIds = [...new Set(filasValidas.map((f) => f.semanaId))];
    const fincaIds = [...new Set(filasValidas.map((f) => f.fincaId))];
    const semanaRegistroIds = [...new Set(filasValidas.map((f) => f.semanaRegistroId))];
    const existentes = await estimacionFincaRepository.findAllBySemanaYFinca({
      semanaIds,
      fincaIds,
      semanaRegistroIds,
      createdBy: actorId,
    });
    const existenteSet = new Set(existentes.map((e) => `${e.semanaId}-${e.fincaId}-${e.semanaRegistroId}`));
    const aInsertar = [];
    for (const f of filasValidas) {
      const clave = `${f.semanaId}-${f.fincaId}-${f.semanaRegistroId}`;
      if (existenteSet.has(clave)) continue;
      existenteSet.add(clave);
      aInsertar.push({ ...f, createdBy: actorId, updatedBy: actorId });
    }
    const saltados = filasValidas.length - aInsertar.length;
    if (aInsertar.length > 0) {
      await estimacionFincaRepository.bulkCreate(aInsertar);
    }
    return {
      totalFilas: filas.length,
      creados: aInsertar.length,
      saltados,
      errores: errores.length > 0 ? errores : undefined,
    };
  },

  async bulkUpdateEstimaciones(file, actorId, user) {
    const filas = parseBulkFile(file);
    if (filas.length === 0) throw ApiError.badRequest('El archivo está vacío');
    if (filas.length > MAX_FILAS_BULK) {
      throw ApiError.badRequest(
        `El archivo tiene ${filas.length.toLocaleString('es')} filas — el máximo por cargue es ${MAX_FILAS_BULK.toLocaleString('es')}. ` +
          'Dividilo en partes más chicas (por ejemplo, por año) y subilas una por una.',
      );
    }
    const fincaIdsPermitidas = getFincaIdsPermitidas(user);
    const { fincaPorCodigo, semanaPorCodigo, semanasOrdenadas } = await cargarCatalogosEstimaciones();
    const { filasValidas, errores } = validarFilasEstimaciones(filas, {
      fincaPorCodigo,
      semanaPorCodigo,
      semanasOrdenadas,
      fincaIdsPermitidas,
    });
    if (filasValidas.length === 0) {
      return { totalFilas: filas.length, actualizados: 0, creados: 0, errores };
    }
    const filasConActor = filasValidas.map((f) => ({ ...f, createdBy: actorId, updatedBy: actorId }));
    const semanaIds = [...new Set(filasValidas.map((f) => f.semanaId))];
    const fincaIds = [...new Set(filasValidas.map((f) => f.fincaId))];
    const semanaRegistroIds = [...new Set(filasValidas.map((f) => f.semanaRegistroId))];
    const existentes = await estimacionFincaRepository.findAllBySemanaYFinca({
      semanaIds,
      fincaIds,
      semanaRegistroIds,
      createdBy: actorId,
    });
    const existenteSet = new Set(existentes.map((e) => `${e.semanaId}-${e.fincaId}-${e.semanaRegistroId}`));
    const actualizados = filasValidas.filter((f) => existenteSet.has(`${f.semanaId}-${f.fincaId}-${f.semanaRegistroId}`)).length;
    // Deduplicar dentro del archivo (última gana) antes del upsert
    const dedup = new Map();
    for (const f of filasConActor) dedup.set(`${f.semanaId}-${f.fincaId}-${f.semanaRegistroId}`, f);
    await estimacionFincaRepository.bulkUpsert([...dedup.values()]);
    return {
      totalFilas: filas.length,
      actualizados,
      creados: filasValidas.length - actualizados,
      errores: errores.length > 0 ? errores : undefined,
    };
  },

  // Compara lo estimado contra lo realmente producido (Producción Semanal),
  // finca por finca y semana por semana — solo tiene sentido para semanas
  // que ya pasaron (una semana futura todavía no tiene producción real).
  // Cuando una misma finca+semana objetivo tiene varias estimaciones (se
  // revisó en más de una semana de registro — ver vista escalera), se
  // muestran las ÚLTIMAS 3 revisiones (mayor semana_registro_id primero),
  // cada una comparada contra el mismo real — son la misma estimación
  // corregida con el tiempo, no cantidades distintas a acumular.
  async getComparativo(query, user) {
    const { fincaIds, soloPropias } = resolverVisibilidad(user);

    let fincaIdsFiltro = fincaIds;
    if (query.fincaUuid) {
      const finca = await Finca.findOne({ where: { uuid: query.fincaUuid } });
      if (!finca) throw ApiError.badRequest('Finca no encontrada');
      assertFincaPermitida(user, finca.id);
      fincaIdsFiltro = await expandirFincaIds([finca.id]);
    }

    let creadoPorUserId;
    if (!soloPropias && query.usuarioUuid) {
      const usuario = await User.findOne({ where: { uuid: query.usuarioUuid } });
      creadoPorUserId = usuario?.id || -1;
    } else if (soloPropias) {
      creadoPorUserId = user.id;
    }

    let estimaciones = await estimacionFincaRepository.findForEscalera({ fincaIds: fincaIdsFiltro, creadoPorUserId });

    // Filtro opcional por año de la semana OBJETIVO (para exportar/consultar
    // un año puntual, ej. desde el Excel).
    if (query.anio) {
      const anioFiltro = Number(query.anio);
      estimaciones = estimaciones.filter((r) => r.semana?.anio === anioFiltro);
    }

    // `${fincaId}-${semanaId}` -> Map(semanaRegistroId -> suma de cajas)
    const porClaveYRegistro = new Map();
    for (const r of estimaciones) {
      const clave = `${r.fincaId}-${r.semanaId}`;
      const registroId = r.semanaRegistroId || 0;
      if (!porClaveYRegistro.has(clave)) porClaveYRegistro.set(clave, new Map());
      const porRegistro = porClaveYRegistro.get(clave);
      porRegistro.set(registroId, (porRegistro.get(registroId) || 0) + Number(r.cajas20kg));
    }

    if (porClaveYRegistro.size === 0) return { items: [] };

    // Últimas 3 revisiones (mayor semana_registro_id primero) por clave.
    const MAX_REVISIONES = 3;
    const top3PorClave = new Map();
    for (const [clave, porRegistro] of porClaveYRegistro.entries()) {
      const ordenadas = [...porRegistro.entries()].sort((a, b) => b[0] - a[0]).slice(0, MAX_REVISIONES);
      top3PorClave.set(clave, ordenadas.map(([registroId, valor]) => ({ registroId, valor })));
    }

    const semanaIds = [...new Set([...top3PorClave.keys()].map((k) => Number(k.split('-')[1])))];
    const registroIds = [...new Set([...top3PorClave.values()].flatMap((revs) => revs.map((r) => r.registroId)).filter(Boolean))];
    const [produccionMap, semanasInfo, registrosInfo, fincasInfo] = await Promise.all([
      produccionSemanalRepository.getCajasPorFincaYSemana({ fincaIds: fincaIdsFiltro, semanaIds }),
      Semana.findAll({ where: { id: semanaIds }, attributes: ['id', 'uuid', 'codigo', 'anio', 'numeroSemana', 'fechaInicio'] }),
      registroIds.length
        ? Semana.findAll({ where: { id: registroIds }, attributes: ['id', 'uuid', 'codigo', 'anio', 'numeroSemana'] })
        : [],
      Finca.findAll({ where: fincaIdsFiltro ? { id: { [Op.in]: fincaIdsFiltro } } : {}, attributes: ['id', 'uuid', 'codigo', 'nombre'] }),
    ]);
    const semanaPorId = new Map(semanasInfo.map((s) => [s.id, s]));
    const registroPorId = new Map(registrosInfo.map((s) => [s.id, s]));
    const fincaPorId = new Map(fincasInfo.map((f) => [f.id, f]));

    const hoy = new Date().toISOString().slice(0, 10);
    const items = [];
    for (const [clave, revisiones] of top3PorClave.entries()) {
      const [fincaIdStr, semanaIdStr] = clave.split('-');
      const fincaId = Number(fincaIdStr);
      const semanaId = Number(semanaIdStr);
      const semana = semanaPorId.get(semanaId);
      // Semana futura: todavía no hay producción real que comparar.
      if (!semana || semana.fechaInicio > hoy) continue;
      const finca = fincaPorId.get(fincaId);
      if (!finca) continue;

      const real = produccionMap.get(`${fincaId}-${semanaId}`) || 0;
      const revisionesOut = revisiones.map((rev) => {
        const estimado = rev.valor;
        const diferencia = Math.round((real - estimado) * 100) / 100;
        const porcentaje = estimado > 0 ? Math.round((diferencia / estimado) * 10000) / 100 : null;
        const registro = registroPorId.get(rev.registroId);
        return {
          semanaRegistro: registro
            ? { uuid: registro.uuid, codigo: registro.codigo, anio: registro.anio, numeroSemana: registro.numeroSemana }
            : null,
          estimado,
          diferencia,
          porcentaje,
        };
      });

      items.push({
        finca: { uuid: finca.uuid, codigo: finca.codigo, nombre: finca.nombre },
        semana: { uuid: semana.uuid, codigo: semana.codigo, anio: semana.anio, numeroSemana: semana.numeroSemana },
        real,
        revisiones: revisionesOut,
      });
    }

    items.sort((a, b) =>
      a.semana.anio - b.semana.anio ||
      a.semana.numeroSemana - b.semana.numeroSemana ||
      a.finca.codigo.localeCompare(b.finca.codigo),
    );

    return { items };
  },

  // Resumen de racimos de una finca puntual, pensado para mostrarse debajo
  // del selector de finca en "Cargar estimaciones":
  //   - cintas: estado REAL (histórico, no proyectado) de los embolses que
  //     ya tienen 13, 14, 15, 16 y 17 semanas de edad (uno por edad, porque
  //     la edad determina una única semana de embolse relativa a hoy).
  //   - patronCorte: una fila por cada una de las últimas PATRON_CORTE_FILAS
  //     semanas LIQUIDADAS de la finca — la cinta de referencia de cada fila
  //     es la que cumplió 12 semanas en esa semana liquidada; se muestra qué
  //     % de TODA la historia de esa cinta correspondió a cada edad 8-12, y
  //     su aprovechamiento (cosechado / decidido, 0-1).
  //   - promedio: promedio simple de esas filas (misma forma que patronCorte).
  async getResumenFinca(query, user) {
    if (!query.fincaUuid) throw ApiError.badRequest('fincaUuid es requerido');
    const finca = await Finca.findOne({ where: { uuid: query.fincaUuid } });
    if (!finca) throw ApiError.badRequest('Finca no encontrada');
    assertFincaPermitida(user, finca.id);

    const semanasAll = await Semana.findAll({
      order: [['fecha_inicio', 'ASC']],
      attributes: ['id', 'uuid', 'codigo', 'anio', 'numeroSemana', 'fechaInicio'],
    });
    const idxPorId = new Map(semanasAll.map((s, i) => [s.id, i]));

    const hoy = new Date().toISOString().slice(0, 10);
    const semanaActual = await semanaRepository.findByFecha(hoy);
    if (!semanaActual) {
      return {
        finca: { uuid: finca.uuid, codigo: finca.codigo, nombre: finca.nombre },
        semanaActual: null,
        cintas: [],
        saldosPorEdad: [],
        semanaEstimado: null,
        proximasSemanas: [],
        estimadoPorCinta: [],
        estimadoCorteProximaSemana: null,
        patronCorte: [],
        promedio: { porEdad: PATRON_CORTE_EDADES.map((edad) => ({ edad, porcentaje: null })), aprovechamiento: null },
        semanasRecientes: [],
        patronCortePctGuardado: null,
        ratioCajasPorSemanaGuardado: null,
        historicoRatio: [],
        proyeccionAnio: [],
      };
    }
    const currentIdx = idxPorId.get(semanaActual.id);

    // Cintas 13-17 (histórico real, respecto a HOY).
    const cintas = await getCintasPorEdad(finca.id, currentIdx, semanasAll, CINTA_EDADES);

    // Saldos 8-12 respecto a la PRÓXIMA semana (currentIdx + 1), no a hoy:
    // lo que hoy tiene edad 7-11 es lo que la semana que viene va a tener
    // edad 8-12 — el saldo pendiente (embolsado - repicado - recusado -
    // procesado, con los movimientos registrados hasta hoy) es la base real
    // sobre la que se estima cuánto se va a cortar la semana que viene.
    const proximaIdx = currentIdx + 1;
    const semanaEstimado = proximaIdx < semanasAll.length ? semanasAll[proximaIdx] : null;
    const saldosPorEdad = semanaEstimado ? await getCintasPorEdad(finca.id, proximaIdx, semanasAll, PATRON_CORTE_EDADES) : [];

    // Próximas 8 semanas (incluida semanaEstimado) — el frontend arma la
    // proyección en cascada (cada cinta envejece 1 semana por semana) usando
    // estos códigos como cabecera.
    const PROXIMAS_SEMANAS_COUNT = 8;
    const proximasSemanasBase = [];
    for (let i = 0; i < PROXIMAS_SEMANAS_COUNT && proximaIdx + i < semanasAll.length; i++) {
      const s = semanasAll[proximaIdx + i];
      proximasSemanasBase.push({ uuid: s.uuid, codigo: s.codigo, numeroSemana: s.numeroSemana });
    }

    // Ratio histórico (cajas ÷ racimos cosechados) de la MISMA semana de
    // calendario (numeroSemana) en años anteriores, promediado por finca —
    // sugerido para convertir el estimado de racimos en cajas en "Sugerido
    // próximas semanas" y para la línea de "promedio histórico por semana"
    // del gráfico. No es el ratio ponderado/estacional completo de
    // Pronóstico (ver pronostico.service.js): acá es un promedio simple,
    // por finca puntual, pensado solo para este panel.
    const HISTORICO_RATIO_SEMANAS = 26;
    const historicoIdxMin = Math.max(currentIdx - HISTORICO_RATIO_SEMANAS + 1, 0);
    const semanasHistoricoRatio = semanasAll.slice(historicoIdxMin, currentIdx + 1);

    // Todas las semanas restantes del año actual (desde la próxima hasta la
    // última semana con ese mismo año en el calendario) — para que el
    // gráfico de ratio llegue hasta el final del año, no solo las 8 de
    // "Sugerido próximas semanas".
    const anioActual = semanaActual.anio;
    let finAnioIdx = currentIdx;
    for (let idx = currentIdx; idx < semanasAll.length && semanasAll[idx].anio === anioActual; idx++) {
      finAnioIdx = idx;
    }
    const proyeccionAnioBase = [];
    for (let idx = proximaIdx; idx <= finAnioIdx; idx++) {
      const s = semanasAll[idx];
      proyeccionAnioBase.push({ uuid: s.uuid, codigo: s.codigo, numeroSemana: s.numeroSemana });
    }

    const numerosSemanaRelevantes = [
      ...new Set([...proximasSemanasBase, ...semanasHistoricoRatio, ...proyeccionAnioBase].map((s) => s.numeroSemana)),
    ];
    const semanasMismoNumero = semanasAll.filter((s) => numerosSemanaRelevantes.includes(s.numeroSemana));
    const semanaIdsHistoricas = semanasMismoNumero.map((s) => s.id);
    const [cajasPorFincaYSemanaHist, cosechadoPorFincaYSemanaHist] = await Promise.all([
      produccionSemanalRepository.getCajasPorFincaYSemana({ fincaIds: [finca.id], semanaIds: semanaIdsHistoricas }),
      racimoMovimientoRepository.getCosechadoPorFincaYSemana({ fincaIds: [finca.id], semanaRegistroIds: semanaIdsHistoricas }),
    ]);
    const ratiosPorNumeroSemana = new Map(); // numeroSemana -> [ratio, ratio, ...]
    const ratioPorFincaYSemana = new Map(); // `${fincaId}-${semanaId}` -> ratio (reutilizado en historicoRatio)
    for (const s of semanasMismoNumero) {
      const cajas = cajasPorFincaYSemanaHist.get(`${finca.id}-${s.id}`);
      const cosechado = cosechadoPorFincaYSemanaHist.get(`${finca.id}-${s.id}`);
      if (cajas > 0 && cosechado > 0) {
        const ratio = cajas / cosechado;
        const lista = ratiosPorNumeroSemana.get(s.numeroSemana) || [];
        lista.push(ratio);
        ratiosPorNumeroSemana.set(s.numeroSemana, lista);
        ratioPorFincaYSemana.set(`${finca.id}-${s.id}`, ratio);
      }
    }
    const promedioPorNumeroSemana = (numeroSemana) => {
      const lista = ratiosPorNumeroSemana.get(numeroSemana) || [];
      return lista.length ? Math.round((lista.reduce((a, b) => a + b, 0) / lista.length) * 100000) / 100000 : null;
    };
    const ratiosGuardados = finca.ratioCajasPorSemana || {};
    const conRatiosGuardados = (s) => {
      const guardadoRaw = ratiosGuardados[String(s.numeroSemana)];
      const ratioGuardado = guardadoRaw !== undefined && guardadoRaw !== null ? Number(guardadoRaw) : null;
      return { ...s, ratioHistorico: promedioPorNumeroSemana(s.numeroSemana), ratioGuardado };
    };
    const proximasSemanas = proximasSemanasBase.map(conRatiosGuardados);
    // Resto del año (desde la próxima semana hasta la última del año actual)
    // — usado solo para extender la línea de ratio proyectado en el gráfico
    // hasta fin de año.
    const proyeccionAnio = proyeccionAnioBase.map(conRatiosGuardados);

    // Serie histórica del ratio (cajas ÷ racimos cosechados) semana a semana,
    // en orden cronológico, para graficar su evolución real — últimas
    // HISTORICO_RATIO_SEMANAS semanas con dato completo (cajas y cosechado
    // > 0), respecto a HOY (no a la próxima semana) — junto con el promedio
    // histórico de esa MISMA semana de calendario (numeroSemana) en años
    // anteriores, para comparar en el gráfico.
    const historicoRatio = semanasHistoricoRatio
      .map((s) => {
        const ratio = ratioPorFincaYSemana.get(`${finca.id}-${s.id}`);
        if (ratio === undefined) return null;
        return {
          semana: { uuid: s.uuid, codigo: s.codigo },
          ratio: Math.round(ratio * 100000) / 100000,
          promedioHistorico: promedioPorNumeroSemana(s.numeroSemana),
        };
      })
      .filter((x) => x !== null);

    // Patrón de corte: una fila por SEMANA LIQUIDADA (no por semana de
    // calendario) — la finca marca una semana como liquidada cuando ya
    // terminó de registrar sus movimientos de racimos de esa semana. La
    // semana liquidada es la semana en la que la cinta embolsada
    // PATRON_CORTE_EDAD_REFERENCIA (12) semanas antes cumplió esa edad — esa
    // es la cinta de referencia de la fila, y se sigue su historia COMPLETA
    // (todas sus semanas de registro), no solo lo cosechado en esa semana.
    const liquidaciones = await FincaSemanaLiquidacion.findAll({
      where: { fincaId: finca.id },
      include: [{ model: Semana, as: 'semana', attributes: ['id', 'uuid', 'codigo', 'anio', 'numeroSemana', 'fechaInicio'] }],
      order: [[{ model: Semana, as: 'semana' }, 'fecha_inicio', 'DESC']],
      limit: PATRON_CORTE_FILAS,
    });
    // De más antigua a más reciente, para que la tabla se lea igual que el resto.
    liquidaciones.reverse();

    const filasReferencia = liquidaciones
      .map((liq) => {
        const semanaLiquidada = liq.semana;
        const liquidadaIdx = idxPorId.get(semanaLiquidada.id);
        if (liquidadaIdx === undefined) return null;
        const embolseIdx = liquidadaIdx - PATRON_CORTE_EDAD_REFERENCIA + 1;
        const semanaEmbolse = embolseIdx >= 0 ? semanasAll[embolseIdx] : null;
        return { semanaLiquidada, semanaEmbolse };
      })
      .filter(Boolean);

    const semanaEmbolseIdsReferencia = [...new Set(filasReferencia.filter((f) => f.semanaEmbolse).map((f) => f.semanaEmbolse.id))];
    const movimientosCohortes = semanaEmbolseIdsReferencia.length
      ? await RacimoMovimiento.findAll({
          where: { fincaId: finca.id, semanaEmbolseId: { [Op.in]: semanaEmbolseIdsReferencia } },
          attributes: ['semanaEmbolseId', 'semanaRegistroId', 'tipo', 'cantidad'],
        })
      : [];

    // Agregados por cohorte (semana de embolse) sobre TODA su historia — ya
    // no una ventana de tiempo, porque una cinta liquidada se sigue completa.
    const porCohorte = new Map();
    for (const m of movimientosCohortes) {
      if (!porCohorte.has(m.semanaEmbolseId)) {
        porCohorte.set(m.semanaEmbolseId, { porEdad: Object.fromEntries(PATRON_CORTE_EDADES.map((e) => [e, 0])), totalProcesado: 0, totalDecidido: 0 });
      }
      const acc = porCohorte.get(m.semanaEmbolseId);
      if (m.tipo === 'PROCESADO' || m.tipo === 'REPIQUE' || m.tipo === 'RECUSE') acc.totalDecidido += m.cantidad;
      if (m.tipo === 'PROCESADO') {
        acc.totalProcesado += m.cantidad;
        const registroIdx = idxPorId.get(m.semanaRegistroId);
        const embolseIdxCohorte = idxPorId.get(m.semanaEmbolseId);
        if (registroIdx !== undefined && embolseIdxCohorte !== undefined) {
          const edad = registroIdx - embolseIdxCohorte + 1;
          if (edad in acc.porEdad) acc.porEdad[edad] += m.cantidad;
        }
      }
    }

    const patronCorte = filasReferencia.map(({ semanaLiquidada, semanaEmbolse }) => {
      const acc = semanaEmbolse ? porCohorte.get(semanaEmbolse.id) : null;
      const porEdad = PATRON_CORTE_EDADES.map((edad) => ({
        edad,
        porcentaje: acc && acc.totalProcesado > 0 ? Math.round(((acc.porEdad[edad] || 0) / acc.totalProcesado) * 10000) / 100 : null,
      }));
      const aprovechamiento = acc && acc.totalDecidido > 0 ? Math.round((acc.totalProcesado / acc.totalDecidido) * 10000) / 10000 : null;
      return {
        semana: { uuid: semanaLiquidada.uuid, codigo: semanaLiquidada.codigo, anio: semanaLiquidada.anio, numeroSemana: semanaLiquidada.numeroSemana },
        semanaEmbolse: semanaEmbolse ? { uuid: semanaEmbolse.uuid, codigo: semanaEmbolse.codigo } : null,
        porEdad,
        aprovechamiento,
      };
    });

    // Fila de promedio simple (no ponderado) de las filas con dato.
    const promedioPorEdad = PATRON_CORTE_EDADES.map((edad) => {
      const valores = patronCorte.map((f) => f.porEdad.find((p) => p.edad === edad)?.porcentaje).filter((v) => v !== null && v !== undefined);
      return { edad, porcentaje: valores.length ? Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 100) / 100 : null };
    });
    const aprovechamientosValidos = patronCorte.map((f) => f.aprovechamiento).filter((v) => v !== null && v !== undefined);
    const promedioAprovechamiento = aprovechamientosValidos.length
      ? Math.round((aprovechamientosValidos.reduce((a, b) => a + b, 0) / aprovechamientosValidos.length) * 10000) / 10000
      : null;

    // Estimado de corte para la PRÓXIMA semana: se aplica el % promedio del
    // patrón de corte (promedioPorEdad) sobre el saldo pendiente de cada
    // edad — salvo que la finca tenga guardado un % propio (editado a mano
    // en el panel), en cuyo caso ese override manda.
    const pctGuardados = finca.patronCortePct || {};
    const estimadoPorCinta = saldosPorEdad.map((s) => {
      const guardado = pctGuardados[String(s.edad)];
      const porcentaje = guardado !== undefined && guardado !== null
        ? Number(guardado)
        : (promedioPorEdad.find((x) => x.edad === s.edad)?.porcentaje ?? null);
      const estimado = porcentaje !== null && s.saldo > 0 ? Math.round(s.saldo * (porcentaje / 100)) : 0;
      return {
        edad: s.edad,
        semanaEmbolse: s.semanaEmbolse,
        saldo: s.saldo,
        porcentaje,
        estimado,
        // Lo que quedaría pendiente de esa cinta después de cortar el estimado.
        saldoTeorico: s.saldo - estimado,
      };
    });
    const estimadoCorteProximaSemana = estimadoPorCinta.reduce((acc, e) => acc + e.estimado, 0);

    // Últimas 12 semanas de calendario, marcando cuáles ya están liquidadas
    // — para el selector de "Liquidar semana" en el frontend.
    const semanaIdsLiquidadas = new Set(liquidaciones.map((l) => l.semanaId));
    const semanasRecientesIdxMin = Math.max(currentIdx - 11, 0);
    const semanasRecientes = semanasAll.slice(semanasRecientesIdxMin, currentIdx + 1).map((s) => ({
      uuid: s.uuid,
      codigo: s.codigo,
      liquidada: semanaIdsLiquidadas.has(s.id),
    }));

    return {
      finca: { uuid: finca.uuid, codigo: finca.codigo, nombre: finca.nombre },
      semanaActual: { uuid: semanaActual.uuid, codigo: semanaActual.codigo },
      cintas,
      saldosPorEdad,
      semanaEstimado: semanaEstimado ? { uuid: semanaEstimado.uuid, codigo: semanaEstimado.codigo } : null,
      proximasSemanas,
      estimadoPorCinta,
      estimadoCorteProximaSemana,
      patronCorte,
      promedio: { porEdad: promedioPorEdad, aprovechamiento: promedioAprovechamiento },
      semanasRecientes,
      patronCortePctGuardado: finca.patronCortePct || null,
      ratioCajasPorSemanaGuardado: finca.ratioCajasPorSemana || null,
      historicoRatio,
      proyeccionAnio,
    };
  },

  // Marca (o re-marca, si ya existía y estaba borrada) una semana como
  // liquidada para una finca — informativo por ahora, no bloquea el
  // registro de movimientos de racimos de semanas siguientes.
  async liquidarSemana(body, actorId, user) {
    if (!body.fincaUuid || !body.semanaUuid) throw ApiError.badRequest('fincaUuid y semanaUuid son requeridos');
    const finca = await Finca.findOne({ where: { uuid: body.fincaUuid } });
    if (!finca) throw ApiError.badRequest('Finca no encontrada');
    assertFincaPermitida(user, finca.id);
    const semana = await Semana.findOne({ where: { uuid: body.semanaUuid } });
    if (!semana) throw ApiError.badRequest('Semana no encontrada');

    const existente = await FincaSemanaLiquidacion.findOne({
      where: { fincaId: finca.id, semanaId: semana.id },
      paranoid: false,
    });
    if (existente) {
      if (!existente.deletedAt) throw ApiError.badRequest(`La semana ${semana.codigo} ya está liquidada para esta finca`);
      await existente.restore();
      await existente.update({ liquidadaEn: new Date(), updatedBy: actorId, deletedBy: null });
      return existente;
    }

    return FincaSemanaLiquidacion.create({
      fincaId: finca.id,
      semanaId: semana.id,
      liquidadaEn: new Date(),
      createdBy: actorId,
      updatedBy: actorId,
    });
  },

  // Deshace la liquidación de una semana (reabrirla para poder volver a
  // registrar/editar movimientos de racimos de esa semana). Ahora que la
  // liquidación bloquea de verdad el registro (ver racimoMovimiento.service.js),
  // reabrir es una acción sensible — solo un Administrador puede hacerla.
  async quitarLiquidacionSemana(body, actorId, user) {
    if (!(user?.roles || []).includes(ROLES.ADMINISTRADOR)) {
      throw ApiError.forbidden('Solo un Administrador puede reabrir (quitar la liquidación de) una semana');
    }
    if (!body.fincaUuid || !body.semanaUuid) throw ApiError.badRequest('fincaUuid y semanaUuid son requeridos');
    const finca = await Finca.findOne({ where: { uuid: body.fincaUuid } });
    if (!finca) throw ApiError.badRequest('Finca no encontrada');
    assertFincaPermitida(user, finca.id);
    const semana = await Semana.findOne({ where: { uuid: body.semanaUuid } });
    if (!semana) throw ApiError.badRequest('Semana no encontrada');

    const existente = await FincaSemanaLiquidacion.findOne({ where: { fincaId: finca.id, semanaId: semana.id } });
    if (!existente) throw ApiError.notFound('Esa semana no está liquidada para esta finca');
    await existente.update({ deletedBy: actorId });
    await existente.destroy();
  },

  // Liquida de una sola vez TODAS las semanas de un rango, para TODAS las
  // fincas operativas (no externas) — pensado para ponerse al día cuando
  // hay muchas semanas atrasadas sin liquidar, en vez de ir finca por finca
  // y semana por semana desde el panel. Solo Administrador: es una acción
  // masiva que bloquea de verdad el registro de movimientos de racimos de
  // esas semanas para todo el mundo (salvo Administrador/editar_historico).
  async liquidarSemanasMasivo(body, actorId, user) {
    if (!(user?.roles || []).includes(ROLES.ADMINISTRADOR)) {
      throw ApiError.forbidden('Solo un Administrador puede liquidar semanas de forma masiva');
    }
    if (!body.semanaDesdeUuid || !body.semanaHastaUuid) {
      throw ApiError.badRequest('semanaDesdeUuid y semanaHastaUuid son requeridos');
    }

    const semanaDesde = await Semana.findOne({ where: { uuid: body.semanaDesdeUuid } });
    if (!semanaDesde) throw ApiError.badRequest('Semana inicial no encontrada');
    const semanaHasta = await Semana.findOne({ where: { uuid: body.semanaHastaUuid } });
    if (!semanaHasta) throw ApiError.badRequest('Semana final no encontrada');

    const fechaMin = semanaDesde.fechaInicio <= semanaHasta.fechaInicio ? semanaDesde.fechaInicio : semanaHasta.fechaInicio;
    const fechaMax = semanaDesde.fechaInicio <= semanaHasta.fechaInicio ? semanaHasta.fechaInicio : semanaDesde.fechaInicio;

    const semanas = await Semana.findAll({
      where: { fechaInicio: { [Op.gte]: fechaMin, [Op.lte]: fechaMax } },
      order: [['fechaInicio', 'ASC']],
    });
    if (semanas.length === 0) throw ApiError.badRequest('No hay semanas en ese rango');

    const fincas = await Finca.findAll({ where: { estado: true, esExterna: false } });
    if (fincas.length === 0) throw ApiError.badRequest('No hay fincas operativas para liquidar');

    const semanaIds = semanas.map((s) => s.id);
    const fincaIds = fincas.map((f) => f.id);

    return sequelize.transaction(async (transaction) => {
      // Incluye las ya borradas (soft-delete) para poder restaurarlas en
      // vez de chocar con el índice único (finca_id, semana_id) al crear
      // una fila nueva — mismo criterio que liquidarSemana().
      const existentes = await FincaSemanaLiquidacion.findAll({
        where: { fincaId: { [Op.in]: fincaIds }, semanaId: { [Op.in]: semanaIds } },
        paranoid: false,
        transaction,
      });
      const existentesPorClave = new Map(existentes.map((e) => [`${e.fincaId}-${e.semanaId}`, e]));

      let creadas = 0;
      let reabiertas = 0;
      let yaLiquidadas = 0;
      const ahora = new Date();

      for (const fincaId of fincaIds) {
        for (const semanaId of semanaIds) {
          const clave = `${fincaId}-${semanaId}`;
          const existente = existentesPorClave.get(clave);
          if (existente) {
            if (!existente.deletedAt) {
              yaLiquidadas += 1;
              continue;
            }
            await existente.restore({ transaction });
            await existente.update({ liquidadaEn: ahora, updatedBy: actorId, deletedBy: null }, { transaction });
            reabiertas += 1;
          } else {
            await FincaSemanaLiquidacion.create(
              { fincaId, semanaId, liquidadaEn: ahora, createdBy: actorId, updatedBy: actorId },
              { transaction },
            );
            creadas += 1;
          }
        }
      }

      return {
        fincas: fincas.length,
        semanas: semanas.length,
        combinacionesTotales: fincaIds.length * semanaIds.length,
        creadas,
        reabiertas,
        yaLiquidadas,
      };
    });
  },

  // Guarda (o limpia) los % editados a mano en la tabla "Distribución por
  // cinta del estimado" del panel de Estimaciones, por finca — para que no
  // se pierdan al recargar. porcentajes: { "8": 0.06, "9": 12.05, ... }
  // (edades 8-12); pasar null/{} limpia el override y vuelve a usar el %
  // promedio del patrón de corte.
  async guardarPatronCortePct(body, actorId, user) {
    if (!body.fincaUuid) throw ApiError.badRequest('fincaUuid es requerido');
    const finca = await Finca.findOne({ where: { uuid: body.fincaUuid } });
    if (!finca) throw ApiError.badRequest('Finca no encontrada');
    assertFincaPermitida(user, finca.id);

    const porcentajes = body.porcentajes || null;
    if (porcentajes) {
      for (const [edad, pct] of Object.entries(porcentajes)) {
        if (!PATRON_CORTE_EDADES.includes(Number(edad))) throw ApiError.badRequest(`Edad inválida: ${edad}`);
        if (pct !== null && (Number.isNaN(Number(pct)) || Number(pct) < 0)) {
          throw ApiError.badRequest(`Porcentaje inválido para edad ${edad}`);
        }
      }
    }

    await finca.update({ patronCortePct: porcentajes, updatedBy: actorId });
    return { patronCortePctGuardado: finca.patronCortePct };
  },

  // Guarda (o limpia) el ratio (cajas por racimo cosechado) editado a mano
  // por numeroSemana, en la tabla "Sugerido próximas semanas" del panel de
  // Estimaciones — por finca, para que no se pierda al recargar.
  // ratios: { "37": 0.0285, ... } (clave = numeroSemana); pasar null/{}
  // limpia el override y vuelve a usar el ratio histórico promedio.
  async guardarRatioCajasPorSemana(body, actorId, user) {
    if (!body.fincaUuid) throw ApiError.badRequest('fincaUuid es requerido');
    const finca = await Finca.findOne({ where: { uuid: body.fincaUuid } });
    if (!finca) throw ApiError.badRequest('Finca no encontrada');
    assertFincaPermitida(user, finca.id);

    const ratios = body.ratios || null;
    if (ratios) {
      for (const [numeroSemana, ratio] of Object.entries(ratios)) {
        const n = Number(numeroSemana);
        if (!Number.isInteger(n) || n < 1 || n > 53) throw ApiError.badRequest(`Semana inválida: ${numeroSemana}`);
        if (ratio !== null && (Number.isNaN(Number(ratio)) || Number(ratio) < 0)) {
          throw ApiError.badRequest(`Ratio inválido para semana ${numeroSemana}`);
        }
      }
    }

    await finca.update({ ratioCajasPorSemana: ratios, updatedBy: actorId });
    return { ratioCajasPorSemanaGuardado: finca.ratioCajasPorSemana };
  },

  // Exporta el comparativo (mismos filtros que getComparativo — fincaUuid,
  // usuarioUuid, anio) a un .xlsx: una fila por finca+semana, con las
  // últimas 3 revisiones en columnas aparte.
  async exportComparativoToExcel(query, user) {
    const { default: XLSX } = await import('xlsx');
    const { items } = await estimacionFincaService.getComparativo(query, user);

    const datos = items.map((it) => {
      const fila = {
        Finca: `${it.finca.codigo} — ${it.finca.nombre}`,
        Semana: it.semana.codigo,
        Real: it.real,
      };
      const etiquetas = ['Última revisión', '2ª revisión', '3ª revisión'];
      for (let i = 0; i < 3; i++) {
        const rev = it.revisiones?.[i];
        const prefijo = etiquetas[i];
        fila[`${prefijo} — semana registro`] = rev?.semanaRegistro?.codigo ?? '';
        fila[`${prefijo} — estimado`] = rev ? rev.estimado : '';
        fila[`${prefijo} — diferencia`] = rev ? rev.diferencia : '';
        fila[`${prefijo} — %`] = rev?.porcentaje ?? '';
      }
      return fila;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(datos);
    XLSX.utils.book_append_sheet(wb, ws, 'Comparativo');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  },
};

export default estimacionFincaService;
