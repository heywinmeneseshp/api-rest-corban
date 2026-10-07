import { Op } from 'sequelize';
import { Finca, Lote, Planta, RacimoMovimiento, LoteAreaProduccion } from '../../database/associations.js';
import { sequelize } from '../../database/connection.js';
import { loteRepository } from '../../repositories/agricola/lote.repository.js';
import { loteAreaProduccionRepository } from '../../repositories/agricola/loteAreaProduccion.repository.js';
import { semanaRepository } from '../../repositories/agricola/semana.repository.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { ROLES } from '../../constants/roles.constants.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { parseBulkFile } from '../../utils/bulkFileParser.js';
import { getFincaIdsPermitidas, assertFincaPermitida } from '../../utils/fincaScope.js';

// ¿Tiene valor (ni null ni undefined)?
const hay = (v) => v !== null && v !== undefined;

const findFincaByUuidOrFail = async (fincaUuid) => {
  const finca = await Finca.findOne({ where: { uuid: fincaUuid } });
  if (!finca) throw ApiError.notFound('Finca no encontrada');
  return finca;
};

const parseEstado = (value) => {
  if (value === undefined || value === '' || value === null) return true;
  const v = String(value).trim().toLowerCase();
  return !['false', '0', 'no', 'inactivo', 'inactive'].includes(v);
};

export const loteService = {
  async listLotes(query, user) {
    const { page, limit, offset } = getPagination(query);
    const fincaId = query.fincaUuid ? (await findFincaByUuidOrFail(query.fincaUuid)).id : undefined;
    if (fincaId) assertFincaPermitida(user, fincaId);
    const { rows, count } = await loteRepository.findAndCountAll({
      limit,
      offset,
      search: query.search,
      fincaId,
      fincaIdsPermitidas: getFincaIdsPermitidas(user),
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getLoteByUuid(uuid, user) {
    const lote = await loteRepository.findByUuid(uuid);
    if (!lote) throw ApiError.notFound('Lote no encontrado');
    const permitidas = getFincaIdsPermitidas(user);
    if (permitidas !== null && !permitidas.includes(lote.fincaId)) {
      throw ApiError.notFound('Lote no encontrado');
    }
    return lote;
  },

  // Genera "{codigoFinca}-{consecutivo}" (ej: "525-01"). Si el nombre del
  // lote es puramente numérico (ej. "18"), se usa ESE número como
  // consecutivo (para que el código coincida con el nombre real del lote
  // en campo), siempre que ese código no esté ya ocupado por otro lote.
  // Si no, cae al consecutivo automático de siempre (cuenta lotes
  // incluidos los eliminados lógicamente, y reintenta si el código ya
  // existiera).
  async generateCodigo(finca, nombre) {
    const nombreEsNumerico = nombre !== undefined && nombre !== null && /^\d+$/.test(String(nombre).trim());
    if (nombreEsNumerico) {
      const codigoPreferido = `${finca.codigo}-${String(parseInt(nombre, 10)).padStart(2, '0')}`;
      const ocupado = await loteRepository.findByFincaAndCodigoIncludingDeleted(finca.id, codigoPreferido);
      if (!ocupado) return codigoPreferido;
    }

    let consecutivo = (await loteRepository.countByFincaId(finca.id)) + 1;
    let codigo;
    do {
      codigo = `${finca.codigo}-${String(consecutivo).padStart(2, '0')}`;
      // Incluye los lotes eliminados: su código sigue ocupado (índice único finca+código).
      const existing = await loteRepository.findByFincaAndCodigoIncludingDeleted(finca.id, codigo);
      if (!existing) break;
      consecutivo += 1;
    } while (true);
    return codigo;
  },

  async createLote(payload, actorId, user) {
    const finca = await findFincaByUuidOrFail(payload.fincaUuid);
    assertFincaPermitida(user, finca.id);

    const nombreDuplicado = await loteRepository.findByFincaAndNombre(finca.id, payload.nombre);
    if (nombreDuplicado) throw ApiError.conflict('Ya existe un lote con ese nombre en esta finca');

    const codigo = payload.codigo || (await this.generateCodigo(finca, payload.nombre));

    const existing = await loteRepository.findByFincaAndCodigo(finca.id, codigo);
    if (existing) throw ApiError.conflict('Ya existe un lote con ese código en esta finca');

    return loteRepository.create({
      fincaId: finca.id,
      codigo,
      nombre: payload.nombre,
      area: payload.area,
      estado: payload.estado ?? true,
      createdBy: actorId,
    });
  },

  async updateLote(uuid, payload, actorId, user) {
    const lote = await this.getLoteByUuid(uuid, user);
    const data = { ...payload, updatedBy: actorId };
    delete data.fincaUuid;

    if (payload.fincaUuid) {
      const finca = await findFincaByUuidOrFail(payload.fincaUuid);
      assertFincaPermitida(user, finca.id);
      data.fincaId = finca.id;
    }

    if (payload.codigo) {
      const fincaId = data.fincaId ?? lote.fincaId;
      const existing = await loteRepository.findByFincaAndCodigo(fincaId, payload.codigo);
      if (existing && existing.id !== lote.id) {
        throw ApiError.conflict('Ya existe un lote con ese código en esta finca');
      }
    }

    if (payload.nombre) {
      const fincaId = data.fincaId ?? lote.fincaId;
      const nombreDuplicado = await loteRepository.findByFincaAndNombre(fincaId, payload.nombre, { excludeId: lote.id });
      if (nombreDuplicado) throw ApiError.conflict('Ya existe un lote con ese nombre en esta finca');
    }

    return loteRepository.update(lote, data);
  },

  async deleteLote(uuid, actorId, userRoles = []) {
    if (!userRoles.includes(ROLES.ADMINISTRADOR)) {
      throw ApiError.forbidden('Solo el administrador puede eliminar lotes');
    }

    // Ya se validó arriba que es Administrador (bypasea scoping de fincas),
    // así que no hace falta pasar `user` aquí.
    const lote = await this.getLoteByUuid(uuid);

    const [totalPlantas, totalMovimientos, totalAreaProduccion] = await Promise.all([
      Planta.count({ where: { loteId: lote.id } }),
      RacimoMovimiento.count({ where: { loteId: lote.id } }),
      LoteAreaProduccion.count({ where: { loteId: lote.id } }),
    ]);

    if (totalPlantas > 0 || totalMovimientos > 0 || totalAreaProduccion > 0) {
      throw ApiError.conflict(
        `No se puede eliminar el lote porque tiene registros asociados: ${totalPlantas} planta(s), ${totalMovimientos} movimiento(s) de racimos, ${totalAreaProduccion} registro(s) de área en producción`,
      );
    }

    await loteRepository.softDelete(lote, actorId);
  },

  async restoreLote(uuid, userRoles = []) {
    if (!userRoles.includes(ROLES.ADMINISTRADOR)) {
      throw ApiError.forbidden('Solo el administrador puede restaurar lotes');
    }

    const lote = await loteRepository.findByUuidIncludingDeleted(uuid);
    if (!lote) throw ApiError.notFound('Lote no encontrado');
    if (!lote.deletedAt) throw ApiError.conflict('El lote no está eliminado');

    await loteRepository.restore(lote);
    return lote;
  },

  async listPlantas(uuid, query, user) {
    const lote = await this.getLoteByUuid(uuid, user);
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await loteRepository.findPlantasByLoteId(lote.id, { limit, offset });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  // Cargue masivo de lotes desde un archivo .csv/.xlsx. Columnas esperadas
  // (encabezados, sin importar mayúsculas/acentos): fincacodigo, nombre,
  // area (opcional), estado (opcional). El código del lote SIEMPRE se
  // genera automáticamente ({codigoFinca}-{consecutivo}). Se valida todo
  // primero y el consecutivo de cada finca se asigna en memoria (contra un
  // set de códigos ya usados, prefetcheado una sola vez), para poder
  // escribir todas las filas válidas en un único bulkCreate.
  async bulkCreateLotes(file, actorId, { dryRun = false, user } = {}) {
    const rows = parseBulkFile(file);
    if (rows.length === 0) throw ApiError.badRequest('El archivo no tiene filas para procesar');

    const errores = [];
    const filasValidas = [];

    for (let i = 0; i < rows.length; i += 1) {
      const fila = i + 2;
      const row = rows[i];
      const fincaCodigo = String(row.fincacodigo || row.codigofinca || '').trim();
      const nombre = String(row.nombre || '').trim();
      const areaRaw = row.area;

      if (!fincaCodigo || !nombre) {
        errores.push({ fila, mensaje: 'Faltan las columnas requeridas: fincaCodigo y/o nombre' });
        continue;
      }

      if (!/^\d+$/.test(nombre)) {
        errores.push({ fila, mensaje: `El nombre del lote debe contener solo números (ej: 01, 02): '${nombre}'` });
        continue;
      }

      const area = areaRaw !== undefined && areaRaw !== '' ? Number(areaRaw) : undefined;
      if (area !== undefined && Number.isNaN(area)) {
        errores.push({ fila, mensaje: 'El área debe ser un número' });
        continue;
      }

      filasValidas.push({ fila, fincaCodigo, nombre, area, estado: parseEstado(row.estado) });
    }

    const fincaCodigos = [...new Set(filasValidas.map((f) => f.fincaCodigo))];
    const fincas = fincaCodigos.length ? await Finca.findAll({ where: { codigo: { [Op.in]: fincaCodigos } } }) : [];
    const fincaPorCodigo = new Map(fincas.map((f) => [f.codigo, f]));

    const fincaIdsPermitidas = getFincaIdsPermitidas(user);

    const filasConFinca = [];
    for (const f of filasValidas) {
      const finca = fincaPorCodigo.get(f.fincaCodigo);
      if (!finca) {
        errores.push({ fila: f.fila, mensaje: `No existe ninguna finca con código '${f.fincaCodigo}'` });
        continue;
      }
      if (fincaIdsPermitidas !== null && !fincaIdsPermitidas.includes(finca.id)) {
        errores.push({ fila: f.fila, mensaje: `No tienes acceso a la finca '${f.fincaCodigo}'` });
        continue;
      }
      filasConFinca.push({ ...f, finca });
    }

    // Consecutivo por finca: arranca en countByFincaId(+1) y evita
    // cualquier código ya usado (incluidos lotes eliminados lógicamente),
    // todo en memoria en vez de una consulta por fila.
    const fincaIds = [...new Set(filasConFinca.map((f) => f.finca.id))];
    const codigosExistentes = fincaIds.length ? await loteRepository.findCodigosByFincaIds(fincaIds) : [];
    const codigosUsadosPorFinca = new Map();
    for (const c of codigosExistentes) {
      if (!codigosUsadosPorFinca.has(c.fincaId)) codigosUsadosPorFinca.set(c.fincaId, new Set());
      codigosUsadosPorFinca.get(c.fincaId).add(c.codigo);
    }

    // Un mismo nombre de lote repetido dentro de la misma finca (ya sea
    // porque ya existía en la BD, o porque el archivo lo trae dos veces) se
    // rechaza — antes esto no se validaba y por eso podían quedar dos lotes
    // "00" en la misma finca con códigos distintos.
    const nombresExistentes = fincaIds.length ? await loteRepository.findNombresByFincaIds(fincaIds) : [];
    const nombresUsadosPorFinca = new Map();
    for (const n of nombresExistentes) {
      if (!nombresUsadosPorFinca.has(n.fincaId)) nombresUsadosPorFinca.set(n.fincaId, new Set());
      nombresUsadosPorFinca.get(n.fincaId).add(n.nombre);
    }

    const filasSinNombreDuplicado = [];
    for (const f of filasConFinca) {
      const usados = nombresUsadosPorFinca.get(f.finca.id) || new Set();
      if (usados.has(f.nombre)) {
        errores.push({ fila: f.fila, mensaje: `Ya existe un lote con nombre '${f.nombre}' en la finca '${f.fincaCodigo}'` });
        continue;
      }
      usados.add(f.nombre);
      nombresUsadosPorFinca.set(f.finca.id, usados);
      filasSinNombreDuplicado.push(f);
    }

    const siguienteConsecutivo = new Map();
    for (const fincaId of fincaIds) {
      siguienteConsecutivo.set(fincaId, (await loteRepository.countByFincaId(fincaId)) + 1);
    }

    // Si el nombre es puramente numérico (ej. "18"), se prefiere ESE número
    // como consecutivo del código, para que coincida con el nombre real del
    // lote en campo; si ya está ocupado o el nombre no es numérico, cae al
    // consecutivo automático de siempre.
    const asignarCodigo = (finca, nombre) => {
      const usados = codigosUsadosPorFinca.get(finca.id) || new Set();

      const nombreEsNumerico = /^\d+$/.test(String(nombre).trim());
      if (nombreEsNumerico) {
        const codigoPreferido = `${finca.codigo}-${String(parseInt(nombre, 10)).padStart(2, '0')}`;
        if (!usados.has(codigoPreferido)) {
          usados.add(codigoPreferido);
          codigosUsadosPorFinca.set(finca.id, usados);
          return codigoPreferido;
        }
      }

      let consecutivo = siguienteConsecutivo.get(finca.id);
      let codigo;
      do {
        codigo = `${finca.codigo}-${String(consecutivo).padStart(2, '0')}`;
        consecutivo += 1;
      } while (usados.has(codigo));
      usados.add(codigo);
      codigosUsadosPorFinca.set(finca.id, usados);
      siguienteConsecutivo.set(finca.id, consecutivo);
      return codigo;
    };

    const filasParaCrear = filasSinNombreDuplicado.map((f) => ({
      fincaId: f.finca.id,
      codigo: asignarCodigo(f.finca, f.nombre),
      nombre: f.nombre,
      area: f.area,
      estado: f.estado,
      createdBy: actorId,
    }));

    if (!dryRun && filasParaCrear.length > 0) {
      await loteRepository.bulkCreate(filasParaCrear);
    }

    return { totalFilas: rows.length, lotesCreados: filasParaCrear.length, errores };
  },

  // Historial de área en producción: el "área disponible" del lote (campo
  // `area`) es casi fija, pero el área realmente en producción cambia con
  // el tiempo — cada registro guarda una medición fechada, sin sobrescribir
  // las anteriores.
  async listAreaProduccion(uuid, query, user) {
    const lote = await this.getLoteByUuid(uuid, user);
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await loteAreaProduccionRepository.findAndCountByLoteId(lote.id, {
      limit,
      offset,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  // ─── Actualización masiva de áreas (Excel) ───
  //
  // La SEMANA a actualizar va en el propio Excel (columna `semana`, obligatoria
  // en cada fila, ej. S41-2026): una misma carga puede actualizar semanas
  // distintas. Solo con el permiso area_lote.actualizar_masivo (el Administrador
  // ya los tiene todos).

  // Plantilla: todos los lotes activos del alcance del usuario con el área
  // vigente hoy; la columna `semana` va vacía a propósito (hay que escribirla).
  async plantillaAreas(user) {
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const semanaActual = await semanaRepository.findByFecha(hoy);
    const fincaIdsPermitidas = getFincaIdsPermitidas(user);
    const lotes = await Lote.findAll({
      where: { estado: true },
      include: [{ model: Finca, as: 'finca', attributes: ['id', 'codigo', 'nombre'], where: fincaIdsPermitidas ? { id: { [Op.in]: fincaIdsPermitidas } } : undefined }],
      order: [['fincaId', 'ASC'], ['nombre', 'ASC']],
    });
    const filas = [];
    for (const l of lotes) {
      const ultimo = await loteAreaProduccionRepository.findLatestByLoteId(l.id);
      filas.push({
        codigoFinca: l.finca.codigo,
        finca: l.finca.nombre,
        lote: l.nombre,
        areaTotal: hay(l.area) ? Number(l.area) : null,
        areaProduccion: ultimo ? Number(ultimo.area) : null,
      });
    }
    return { semanaActual: semanaActual ? semanaActual.codigo : null, filas };
  },

  async bulkActualizarAreas(file, { dryRun = false } = {}, actorId, user) {
    const rows = parseBulkFile(file);
    if (rows.length === 0) throw ApiError.badRequest('El archivo no tiene filas para procesar');
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const semanaActual = await semanaRepository.findByFecha(hoy);
    const fincaIdsPermitidas = getFincaIdsPermitidas(user);

    const numero = (v) => {
      if (v === undefined || v === null || String(v).trim() === '') return undefined;
      const n = Number(String(v).replace(',', '.'));
      return Number.isFinite(n) ? n : NaN;
    };
    // El nombre de la columna puede traer "_" (la plantilla lo usa): se ignora.
    const dato = (row, ...claves) => {
      for (const c of claves) if (row[c] !== undefined && row[c] !== '') return row[c];
      for (const [k, v] of Object.entries(row)) if (claves.includes(k.replace(/_/g, '')) && v !== '') return v;
      return undefined;
    };

    const errores = [];
    const aplicar = [];
    const vistaPrevia = [];
    const fincasCache = new Map();
    const semanasCache = new Map();
    const vistos = new Set();
    const lotesNuevos = new Map(); // `${fincaId}|${nombre}` -> { finca, nombre, instancia }

    for (let i = 0; i < rows.length; i++) {
      const fila = i + 2; // fila del Excel (1 = encabezados)
      const row = rows[i];
      const codigoFinca = String(dato(row, 'codigofinca') ?? '').trim();
      const nombreLote = String(dato(row, 'lote', 'nombrelote') ?? '').trim();
      const codigoSemana = String(dato(row, 'semana', 'codigosemana') ?? '').trim();
      if (!codigoFinca && !nombreLote && !codigoSemana) continue; // fila vacía
      if (!codigoFinca || !nombreLote) {
        errores.push({ fila, error: 'Faltan el código de la finca o el lote' });
        continue;
      }
      if (!codigoSemana) {
        errores.push({ fila, error: 'Falta la semana a actualizar (ej. S41-2026): es obligatoria en cada fila' });
        continue;
      }

      if (!semanasCache.has(codigoSemana.toUpperCase())) {
        semanasCache.set(codigoSemana.toUpperCase(), await semanaRepository.findByCodigo(codigoSemana.toUpperCase()));
      }
      const semana = semanasCache.get(codigoSemana.toUpperCase());
      if (!semana) {
        errores.push({ fila, error: `No existe la semana ${codigoSemana}` });
        continue;
      }
      if (semanaActual && semana.fechaInicio > semanaActual.fechaInicio) {
        errores.push({ fila, error: `La semana ${semana.codigo} es futura: no se puede actualizar` });
        continue;
      }
      const esActual = !semanaActual || semana.id === semanaActual.id;

      if (!fincasCache.has(codigoFinca)) {
        fincasCache.set(codigoFinca, await Finca.findOne({ where: { codigo: codigoFinca } }));
      }
      const finca = fincasCache.get(codigoFinca);
      if (!finca) {
        errores.push({ fila, error: `No existe la finca con código ${codigoFinca}` });
        continue;
      }
      if (fincaIdsPermitidas && !fincaIdsPermitidas.includes(finca.id)) {
        errores.push({ fila, error: `No tienes acceso a la finca ${codigoFinca}` });
        continue;
      }
      // Incluye los lotes OCULTOS (inactivos o eliminados): el área se agrega a ese
      // mismo lote en lugar de crear otro.
      let lote = await Lote.findOne({ where: { fincaId: finca.id, nombre: nombreLote }, paranoid: false });
      // Excel suele quitar los ceros a la izquierda (el lote 00000 llega como "0"): si el
      // nombre no existe tal cual pero es numérico, se usa el lote de esa finca con el
      // MISMO valor numérico. Si hay más de uno (no eliminado), la fila se reporta.
      if (!lote && /^\d+$/.test(nombreLote)) {
        const equivalentes = (await Lote.findAll({ where: { fincaId: finca.id }, paranoid: false })).filter(
          (l) => /^\d+$/.test(l.nombre) && parseInt(l.nombre, 10) === parseInt(nombreLote, 10),
        );
        const vigentes = equivalentes.filter((l) => !l.deletedAt);
        const candidatos = vigentes.length > 0 ? vigentes : equivalentes;
        if (candidatos.length > 1) {
          errores.push({ fila, error: `El lote ${nombreLote} es ambiguo en la finca ${codigoFinca}: coincide con ${candidatos.map((l) => l.nombre).join(', ')}` });
          continue;
        }
        if (candidatos.length === 1) lote = candidatos[0];
      }
      let nuevoLote = false;
      if (!lote) {
        // Un lote que no existe se CREA (como en el alta de lotes: el nombre es numérico).
        if (!/^\d+$/.test(nombreLote)) {
          errores.push({ fila, error: `El lote ${nombreLote} no existe en la finca ${codigoFinca} y no se puede crear: el nombre debe ser solo números` });
          continue;
        }
        if (!lotesNuevos.has(`${finca.id}|${nombreLote}`)) lotesNuevos.set(`${finca.id}|${nombreLote}`, { finca, nombre: nombreLote, instancia: null });
        lote = { id: null, nuevo: true, area: null, fincaId: finca.id, nombre: nombreLote };
        nuevoLote = true;
      }
      const clave = lote.id ? `${lote.id}|${semana.id}` : `nuevo|${finca.id}|${nombreLote}|${semana.id}`;
      if (vistos.has(clave)) {
        errores.push({ fila, error: `El lote ${nombreLote} de la finca ${codigoFinca} está repetido para la semana ${semana.codigo}` });
        continue;
      }
      vistos.add(clave);

      const total = numero(dato(row, 'areatotal', 'total'));
      const prod = numero(dato(row, 'areaenproduccion', 'areaproduccion', 'enproduccion', 'produccion'));
      if (Number.isNaN(total) || Number.isNaN(prod) || (total !== undefined && total < 0) || (prod !== undefined && prod < 0)) {
        errores.push({ fila, error: 'Las áreas deben ser números mayores o iguales a 0' });
        continue;
      }
      if (total === undefined && prod === undefined) continue; // sin cambios en esta fila

      // Un campo vacío conserva el valor vigente en esa semana.
      const vig = lote.id ? await loteAreaProduccionRepository.areaVigenteEnSemana(lote.id, semana) : null;
      const prodFinal = prod !== undefined ? prod : vig ? Number(vig.area) : undefined;
      if (prodFinal === undefined) {
        errores.push({ fila, error: 'El lote no tiene área en producción registrada: escribe un valor' });
        continue;
      }
      const totalFinal = total !== undefined ? total : esActual ? (hay(lote.area) ? Number(lote.area) : null) : hay(vig?.areaTotal) ? Number(vig.areaTotal) : null;

      const ocultoLote = !nuevoLote && (!lote.estado || !!lote.deletedAt);
      aplicar.push({ lote, nuevoLote, semana, esActual, total: totalFinal, totalCambia: total !== undefined, prod: prodFinal });
      vistaPrevia.push({ fila, semana: semana.codigo, codigoFinca, lote: lote.nombre, nuevoLote, ocultoLote, areaTotal: totalFinal, areaProduccion: prodFinal });
    }

    // Lotes que no existían: se crean (activos, sin área total; el código se
    // genera solo). Solo los que tienen al menos una fila válida para aplicar.
    const nuevosCreados = [];
    if (!dryRun) {
      for (const a of aplicar) {
        if (!a.nuevoLote) continue;
        const clave = `${a.lote.fincaId}|${a.lote.nombre}`;
        const reg = lotesNuevos.get(clave);
        if (!reg.instancia) {
          const codigo = await this.generateCodigo(reg.finca, reg.nombre);
          reg.instancia = await Lote.create({ fincaId: reg.finca.id, codigo, nombre: reg.nombre, area: null, estado: true, createdBy: actorId });
          nuevosCreados.push({ codigoFinca: reg.finca.codigo, lote: reg.nombre, codigo: reg.instancia.codigo });
        }
        a.lote = reg.instancia;
      }
    }

    if (!dryRun && aplicar.length > 0) {
      await sequelize.transaction(async (transaction) => {
        for (const a of aplicar) {
          await LoteAreaProduccion.create(
            {
              loteId: a.lote.id,
              area: a.prod,
              areaTotal: a.total,
              fechaRegistro: hoy,
              semanaId: a.semana.id,
              createdBy: actorId,
            },
            { transaction },
          );
          // El total del lote solo se actualiza al editar la semana actual.
          if (a.esActual && a.totalCambia && a.total !== null) {
            await a.lote.update({ area: a.total, updatedBy: actorId }, { transaction });
          }
        }
      });
    }

    return {
      totalFilas: rows.length,
      actualizados: aplicar.length,
      lotesNuevos: dryRun
        ? [...new Map(aplicar.filter((a) => a.nuevoLote).map((a) => [`${a.lote.fincaId}|${a.lote.nombre}`, { codigoFinca: a.lote.fincaId && lotesNuevos.get(`${a.lote.fincaId}|${a.lote.nombre}`).finca.codigo, lote: a.lote.nombre }])).values()]
        : nuevosCreados,
      semanas: [...new Set(aplicar.map((a) => a.semana.codigo))],
      errores,
      vistaPrevia: vistaPrevia.slice(0, 200),
      dryRun,
    };
  },

  // Registra el área de un lote en una SEMANA: por defecto la actual; elegir una
  // anterior exige el permiso area_lote.editar_semanas_anteriores (el
  // Administrador ya los tiene todos). Una semana futura se rechaza.
  async registerAreaProduccion(uuid, payload, actorId, user) {
    const lote = await this.getLoteByUuid(uuid, user);
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const semanaActual = await semanaRepository.findByFecha(hoy);

    let semana = semanaActual;
    if (payload.semanaUuid) {
      semana = await semanaRepository.findByUuid(payload.semanaUuid);
      if (!semana) throw ApiError.notFound('Semana no encontrada');
    }
    if (semana && semanaActual && semana.fechaInicio > semanaActual.fechaInicio) {
      throw ApiError.badRequest('No se puede registrar el área de una semana futura');
    }
    const esAnterior = semana && semanaActual && semana.fechaInicio < semanaActual.fechaInicio;
    if (esAnterior && !(user?.permissions || []).includes(PERMISSIONS.AREA_LOTE_EDITAR_SEMANAS_ANTERIORES)) {
      throw ApiError.forbidden('No tienes permiso para editar el área de semanas anteriores');
    }

    return loteAreaProduccionRepository.create({
      loteId: lote.id,
      area: payload.area,
      areaTotal: payload.areaTotal ?? null,
      // Fecha real del guardado (no la de la semana editada).
      fechaRegistro: hoy,
      semanaId: semana ? semana.id : null,
      createdBy: actorId,
    });
  },
};

export default loteService;
