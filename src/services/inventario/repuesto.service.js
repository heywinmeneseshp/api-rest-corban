import { ArticuloCategoria } from '../../database/associations.js';
import { articuloService } from './articulo.service.js';

// Piezas y repuestos (menú Equipos): artículos de inventario cuya categoría es de tipo REPUESTO. Los que se crean desde este módulo caen
// siempre en la categoría fija "Piezas y repuestos" — mismo patrón que los insumos de Sanidad Vegetal (ingredienteActivoInsumo.service.js).
const CATEGORIA_REPUESTOS_NOMBRE = 'Piezas y repuestos';

async function resolveOrCrearCategoria(actorId) {
  const existente = await ArticuloCategoria.findOne({ where: { nombre: CATEGORIA_REPUESTOS_NOMBRE } });
  if (existente) return existente;
  try {
    return await ArticuloCategoria.create({ nombre: CATEGORIA_REPUESTOS_NOMBRE, tipo: 'REPUESTO', estado: true, createdBy: actorId });
  } catch (err) {
    // Condición de carrera: otra request la creó primero (nombre único).
    const yaCreada = await ArticuloCategoria.findOne({ where: { nombre: CATEGORIA_REPUESTOS_NOMBRE } });
    if (yaCreada) return yaCreada;
    throw err;
  }
}

export const repuestoService = {
  // Todos los artículos de categorías tipo REPUESTO (la fija y cualquier otra de ese tipo creada en Categorías).
  list(query, user) {
    return articuloService.list({ ...query, tipo: 'REPUESTO' }, user);
  },

  getByUuid(uuid, user) {
    return articuloService.getByUuid(uuid, user);
  },

  async create(payload, actorId) {
    const categoria = await resolveOrCrearCategoria(actorId);
    return articuloService.create({ ...payload, categoriaUuid: categoria.uuid }, actorId);
  },

  // La categoría no se cambia desde aquí.
  update(uuid, payload, actorId, user) {
    const { categoriaUuid: _categoriaUuid, ...resto } = payload;
    return articuloService.update(uuid, resto, actorId, user);
  },

  delete(uuid, actorId) {
    return articuloService.delete(uuid, actorId);
  },

  // Papelera: los eliminados de la categoría fija.
  async listDeleted(query) {
    const categoria = await ArticuloCategoria.findOne({ where: { nombre: CATEGORIA_REPUESTOS_NOMBRE } });
    if (!categoria) return { items: [], meta: { page: 1, limit: Number(query.limit) || 50, total: 0, totalPages: 0 } };
    return articuloService.listDeleted({ ...query, categoriaUuid: categoria.uuid });
  },

  restore(uuid) {
    return articuloService.restore(uuid);
  },
};

export default repuestoService;
