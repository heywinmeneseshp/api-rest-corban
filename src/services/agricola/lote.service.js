import { Op } from 'sequelize';
import { Finca, Planta, RacimoMovimiento, LoteAreaProduccion } from '../../database/associations.js';
import { loteRepository } from '../../repositories/agricola/lote.repository.js';
import { loteAreaProduccionRepository } from '../../repositories/agricola/loteAreaProduccion.repository.js';
import { ROLES } from '../../constants/roles.constants.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { parseBulkFile } from '../../utils/bulkFileParser.js';
import { getFincaIdsPermitidas, assertFincaPermitida } from '../../utils/fincaScope.js';

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
    const { rows, count } = await loteRepository.findAndCountAll({
      limit,
      offset,
      search: query.search,
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
      const existing = await loteRepository.findByFincaAndCodigo(finca.id, codigo);
      if (!existing) break;
      consecutivo += 1;
    } while (true);
    return codigo;
  },

  async createLote(payload, actorId, user) {
    const finca = await findFincaByUuidOrFail(payload.fincaUuid);
    assertFincaPermitida(user, finca.id);
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

    const filasParaCrear = filasConFinca.map((f) => ({
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

  async registerAreaProduccion(uuid, payload, actorId, user) {
    const lote = await this.getLoteByUuid(uuid, user);
    return loteAreaProduccionRepository.create({
      loteId: lote.id,
      area: payload.area,
      fechaRegistro: payload.fecha || new Date().toISOString().slice(0, 10),
      createdBy: actorId,
    });
  },
};

export default loteService;
