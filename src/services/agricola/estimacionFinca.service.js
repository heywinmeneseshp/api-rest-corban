import { Op } from 'sequelize';
import { estimacionFincaRepository } from '../../repositories/agricola/estimacionFinca.repository.js';
import { semanaRepository } from '../../repositories/agricola/semana.repository.js';
import { Finca, Semana, User } from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';
import { getFincaIdsPermitidas, assertFincaPermitida, expandirFincaIds } from '../../utils/fincaScope.js';
import { configuracionService } from '../sistema/configuracion.service.js';
import { parseBulkFile } from '../../utils/bulkFileParser.js';

const SEMANAS_DEFAULT = 8;
const MAX_ITEMS = 1000;
const MAX_FILAS_BULK = 15000;

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

    // Columnas = todas las semanas del año vigente (aunque no haya datos)
    let columnas;
    if (registros.length === 0) {
      const anioVigente = semanaActual?.anio || new Date().getFullYear();
      columnas = semanasAll.filter((s) => s.anio === anioVigente);
      if (columnas.length === 0) columnas = [...semanasAll];
    } else {
      const aniosConDatos = new Set(registros.map((r) => r.semana?.anio).filter(Boolean));
      if (aniosConDatos.size === 0 && semanaActual) aniosConDatos.add(semanaActual.anio);
      if (aniosConDatos.size === 0) aniosConDatos.add(new Date().getFullYear());
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

    // Asegurar que existan todas las filas del año vigente (aunque estén vacías)
    const anioVigente = semanaActual?.anio || new Date().getFullYear();
    const semanasVigentes = semanasAll.filter((s) => s.anio === anioVigente);
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

    const filasRaw = [...filasMap.values()].sort((a, b) => String(a.sortKey).localeCompare(String(b.sortKey)));

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

    return { columnas: columnasOut, filas, semanaActual: semanaActualOut };
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
};

export default estimacionFincaService;
