import { motivoRecuseRepository } from '../../repositories/agricola/motivoRecuse.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { parseBulkFile } from '../../utils/bulkFileParser.js';

function parseEstado(valor) {
  if (valor === undefined || valor === '') return true;
  const texto = String(valor).trim().toLowerCase();
  return !['inactivo', 'false', '0', 'no'].includes(texto);
}

export const motivoRecuseService = {
  async listMotivos(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await motivoRecuseRepository.findAndCountAll({
      limit,
      offset,
      search: query.search,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getMotivoByUuid(uuid) {
    const motivo = await motivoRecuseRepository.findByUuid(uuid);
    if (!motivo) throw ApiError.notFound('Motivo de recuse no encontrado');
    return motivo;
  },

  async createMotivo(payload, actorId) {
    const existing = await motivoRecuseRepository.findByNombre(payload.nombre);
    if (existing) throw ApiError.conflict('Ya existe un motivo de recuse con ese nombre');

    return motivoRecuseRepository.create({
      nombre: payload.nombre,
      descripcion: payload.descripcion,
      estado: payload.estado ?? true,
      createdBy: actorId,
    });
  },

  async updateMotivo(uuid, payload, actorId) {
    const motivo = await this.getMotivoByUuid(uuid);

    if (payload.nombre) {
      const existing = await motivoRecuseRepository.findByNombre(payload.nombre);
      if (existing && existing.id !== motivo.id) {
        throw ApiError.conflict('Ya existe un motivo de recuse con ese nombre');
      }
    }

    return motivoRecuseRepository.update(motivo, { ...payload, updatedBy: actorId });
  },

  async deleteMotivo(uuid, actorId) {
    const motivo = await this.getMotivoByUuid(uuid);
    await motivoRecuseRepository.softDelete(motivo, actorId);
  },

  // Cargue masivo desde .csv/.xlsx. Columnas esperadas: nombre, descripcion
  // (opcional), estado (opcional: activo/inactivo). Si ya existe un motivo
  // con ese nombre, se actualiza en vez de duplicarlo. Sin dependencias
  // entre filas, así que se valida todo primero y se escribe en un solo
  // bulkCreate con upsert (INSERT ... ON DUPLICATE KEY UPDATE), en vez de
  // una consulta por fila.
  async bulkCreateMotivos(file, actorId, { dryRun = false } = {}) {
    const rows = parseBulkFile(file);
    if (rows.length === 0) throw ApiError.badRequest('El archivo no tiene filas para procesar');

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
    const existentes = nombres.length ? await motivoRecuseRepository.findByNombres(nombres) : [];
    const nombresExistentes = new Set(existentes.map((m) => m.nombre));

    const creados = filasUnicas.filter((f) => !nombresExistentes.has(f.nombre)).length;
    const actualizados = filasUnicas.length - creados;

    if (!dryRun && filasUnicas.length > 0) {
      await motivoRecuseRepository.bulkUpsert(
        filasUnicas.map((f) => ({
          nombre: f.nombre,
          descripcion: f.descripcion,
          estado: f.estado,
          createdBy: actorId,
          updatedBy: actorId,
        })),
      );
    }

    return { totalFilas: rows.length, motivosCreados: creados, motivosActualizados: actualizados, errores };
  },
};

export default motivoRecuseService;
