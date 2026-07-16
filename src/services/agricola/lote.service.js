import { Finca } from '../../database/associations.js';
import { loteRepository } from '../../repositories/agricola/lote.repository.js';
import { fincaRepository } from '../../repositories/agricola/finca.repository.js';
import { loteAreaProduccionRepository } from '../../repositories/agricola/loteAreaProduccion.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { parseBulkFile } from '../../utils/bulkFileParser.js';

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
  async listLotes(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await loteRepository.findAndCountAll({
      limit,
      offset,
      search: query.search,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getLoteByUuid(uuid) {
    const lote = await loteRepository.findByUuid(uuid);
    if (!lote) throw ApiError.notFound('Lote no encontrado');
    return lote;
  },

  // Genera "{codigoFinca}-{consecutivo}" (ej: "525-01"). Cuenta lotes
  // incluidos los eliminados lógicamente para no repetir un consecutivo,
  // y reintenta si por alguna carrera ese código ya existiera.
  async generateCodigo(finca) {
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

  async createLote(payload, actorId) {
    const finca = await findFincaByUuidOrFail(payload.fincaUuid);
    const codigo = payload.codigo || (await this.generateCodigo(finca));

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

  async updateLote(uuid, payload, actorId) {
    const lote = await this.getLoteByUuid(uuid);
    const data = { ...payload, updatedBy: actorId };
    delete data.fincaUuid;

    if (payload.fincaUuid) {
      const finca = await findFincaByUuidOrFail(payload.fincaUuid);
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

  async deleteLote(uuid, actorId) {
    const lote = await this.getLoteByUuid(uuid);
    await loteRepository.softDelete(lote, actorId);
  },

  async listPlantas(uuid, query) {
    const lote = await this.getLoteByUuid(uuid);
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await loteRepository.findPlantasByLoteId(lote.id, { limit, offset });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  // Cargue masivo de lotes desde un archivo .csv/.xlsx. Columnas esperadas
  // (encabezados, sin importar mayúsculas/acentos): fincacodigo, nombre,
  // area (opcional), estado (opcional). El código del lote SIEMPRE se
  // genera automáticamente ({codigoFinca}-{consecutivo}), igual que al
  // crear un lote individual.
  async bulkCreateLotes(file, actorId) {
    const rows = parseBulkFile(file);
    if (rows.length === 0) throw ApiError.badRequest('El archivo no tiene filas para procesar');

    let creados = 0;
    const errores = [];
    const fincaCache = new Map();

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

      try {
        let finca = fincaCache.get(fincaCodigo);
        if (finca === undefined) {
          finca = await fincaRepository.findByCodigo(fincaCodigo);
          fincaCache.set(fincaCodigo, finca);
        }
        if (!finca) {
          errores.push({ fila, mensaje: `No existe ninguna finca con código '${fincaCodigo}'` });
          continue;
        }

        const area = areaRaw !== undefined && areaRaw !== '' ? Number(areaRaw) : undefined;
        if (area !== undefined && Number.isNaN(area)) {
          errores.push({ fila, mensaje: 'El área debe ser un número' });
          continue;
        }

        const codigo = await this.generateCodigo(finca);
        await loteRepository.create({
          fincaId: finca.id,
          codigo,
          nombre,
          area,
          estado: parseEstado(row.estado),
          createdBy: actorId,
        });
        creados += 1;
      } catch (error) {
        errores.push({ fila, mensaje: error.message || 'Error al procesar la fila' });
      }
    }

    return { totalFilas: rows.length, lotesCreados: creados, errores };
  },

  // Historial de área en producción: el "área disponible" del lote (campo
  // `area`) es casi fija, pero el área realmente en producción cambia con
  // el tiempo — cada registro guarda una medición fechada, sin sobrescribir
  // las anteriores.
  async listAreaProduccion(uuid, query) {
    const lote = await this.getLoteByUuid(uuid);
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await loteAreaProduccionRepository.findAndCountByLoteId(lote.id, {
      limit,
      offset,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async registerAreaProduccion(uuid, payload, actorId) {
    const lote = await this.getLoteByUuid(uuid);
    return loteAreaProduccionRepository.create({
      loteId: lote.id,
      area: payload.area,
      fechaRegistro: payload.fecha || new Date().toISOString().slice(0, 10),
      createdBy: actorId,
    });
  },
};

export default loteService;
