import { ingredienteActivoRepository } from '../../repositories/agricola/ingredienteActivo.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { parseBulkFile } from '../../utils/bulkFileParser.js';

function parseEstado(valor) {
  if (valor === undefined || valor === '') return true;
  const texto = String(valor).trim().toLowerCase();
  return !['inactivo', 'false', '0', 'no'].includes(texto);
}

export const ingredienteActivoService = {
  async listIngredientesActivos(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await ingredienteActivoRepository.findAndCountAll({
      limit,
      offset,
      search: query.search,
      estado: query.estado,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getIngredienteActivoByUuid(uuid) {
    const ingrediente = await ingredienteActivoRepository.findByUuid(uuid);
    if (!ingrediente) throw ApiError.notFound('Ingrediente activo no encontrado');
    return ingrediente;
  },

  async createIngredienteActivo(payload, actorId) {
    const existing = await ingredienteActivoRepository.findByNombre(payload.nombre);
    if (existing) throw ApiError.conflict('Ya existe un ingrediente activo con ese nombre');

    return ingredienteActivoRepository.create({
      nombre: payload.nombre,
      descripcion: payload.descripcion,
      estado: payload.estado ?? true,
      createdBy: actorId,
    });
  },

  async updateIngredienteActivo(uuid, payload, actorId) {
    const ingrediente = await this.getIngredienteActivoByUuid(uuid);

    if (payload.nombre) {
      const existing = await ingredienteActivoRepository.findByNombre(payload.nombre);
      if (existing && existing.id !== ingrediente.id) {
        throw ApiError.conflict('Ya existe un ingrediente activo con ese nombre');
      }
    }

    return ingredienteActivoRepository.update(ingrediente, { ...payload, updatedBy: actorId });
  },

  async deleteIngredienteActivo(uuid, actorId) {
    const ingrediente = await this.getIngredienteActivoByUuid(uuid);
    await ingredienteActivoRepository.softDelete(ingrediente, actorId);
  },

  // Papelera: solo ingredientes activos eliminados lógicamente. Acceso
  // restringido al rol Administrador desde la ruta (requireAdmin).
  async listDeleted(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await ingredienteActivoRepository.findAndCountAllDeleted({
      limit,
      offset,
      search: query.search,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  // Acceso restringido al rol Administrador desde la ruta (requireAdmin).
  async restore(uuid) {
    const ingrediente = await ingredienteActivoRepository.findByUuidIncludingDeleted(uuid);
    if (!ingrediente) throw ApiError.notFound('Ingrediente activo no encontrado');
    if (!ingrediente.deletedAt) throw ApiError.conflict('El ingrediente activo no está eliminado');
    await ingredienteActivoRepository.restore(ingrediente);
    return ingrediente;
  },

  // Cargue masivo desde .csv/.xlsx. Columnas esperadas: nombre, descripcion
  // (opcional), estado (opcional: activo/inactivo). Si ya existe un
  // ingrediente activo con ese nombre, se actualiza en vez de duplicarlo.
  // Sin dependencias entre filas, así que se valida todo primero y se
  // escribe en un solo bulkCreate con upsert, igual patrón que
  // motivoRepique.service.js#bulkCreateMotivos.
  async bulkCreateIngredientesActivos(file, actorId, { dryRun = false } = {}) {
    const rows = parseBulkFile(file);
    if (rows.length === 0) throw ApiError.badRequest('El archivo no tiene filas para procesar');

    // Mismo caso inverso que ingredienteActivoInsumo.service.js#bulkCreateInsumos
    // — si el archivo trae columnas propias de la plantilla de Insumos
    // (que acá se ignorarían en silencio), avisar en vez de procesar solo
    // nombre/descripcion/estado sin que el usuario note el error.
    const columnasArchivo = new Set(Object.keys(rows[0] || {}));
    const columnasSoloInsumos = ['codigo', 'unidadmedida', 'costocompra', 'precioventa', 'manejainventario', 'stockminimo', 'stockmaximo', 'dosisporhectarea', 'dosisunidad', 'ingredientesactivos', 'almacenes'];
    if (columnasSoloInsumos.some((c) => columnasArchivo.has(c))) {
      throw ApiError.badRequest(
        'Las columnas del archivo no coinciden con la plantilla de Ingredientes Activos — parece ser la plantilla de Insumos. Descarga la plantilla de Ingredientes Activos y volvé a intentar.',
      );
    }

    const errores = [];
    const filasValidas = [];

    for (let i = 0; i < rows.length; i += 1) {
      const fila = i + 2;
      const row = rows[i];
      const nombre = String(row.nombre || '').trim();

      if (!nombre) {
        errores.push({ fila, mensaje: 'Falta la columna requerida: nombre' });
        continue;
      }

      const descripcion = row.descripcion ? String(row.descripcion).trim() : undefined;
      const estado = parseEstado(row.estado);
      filasValidas.push({ nombre, descripcion, estado });
    }

    // Si el mismo nombre aparece varias veces en el archivo, se procesa una
    // sola vez con los valores de su última aparición.
    const porNombre = new Map();
    for (const f of filasValidas) porNombre.set(f.nombre, f);
    const filasUnicas = [...porNombre.values()];

    const nombres = filasUnicas.map((f) => f.nombre);
    const existentes = nombres.length ? await ingredienteActivoRepository.findByNombres(nombres) : [];
    const nombresExistentes = new Set(existentes.map((i) => i.nombre));

    const creados = filasUnicas.filter((f) => !nombresExistentes.has(f.nombre)).length;
    const actualizados = filasUnicas.length - creados;

    if (!dryRun && filasUnicas.length > 0) {
      await ingredienteActivoRepository.bulkUpsert(
        filasUnicas.map((f) => ({
          nombre: f.nombre,
          descripcion: f.descripcion,
          estado: f.estado,
          createdBy: actorId,
          updatedBy: actorId,
        })),
      );
    }

    return { totalFilas: rows.length, ingredientesCreados: creados, ingredientesActualizados: actualizados, errores };
  },
};

export default ingredienteActivoService;
