import { productoRepository } from '../../repositories/agricola/producto.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { logger } from '../../utils/logger.js';
import { configuracionService } from '../sistema/configuracion.service.js';

export const productoService = {
  async listProductos(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await productoRepository.findAndCountAll({ limit, offset, search: query.search });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getProductoByUuid(uuid) {
    const producto = await productoRepository.findByUuid(uuid);
    if (!producto) throw ApiError.notFound('Producto no encontrado');
    return producto;
  },

  async createProducto(payload, actorId) {
    const existing = await productoRepository.findByNombre(payload.nombre);
    if (existing) throw ApiError.conflict('Ya existe un producto con ese nombre');

    return productoRepository.create({
      nombre: payload.nombre,
      codigo: payload.codigo || null,
      pesoNeto: payload.pesoNeto ?? null,
      pesoBruto: payload.pesoBruto ?? null,
      cajasPorPalet: payload.cajasPorPalet ?? null,
      cajasPorMinipalet: payload.cajasPorMinipalet ?? null,
      cantidadPalets: payload.cantidadPalets ?? null,
      cantidadMinipalets: payload.cantidadMinipalets ?? null,
      estado: payload.estado ?? true,
      createdBy: actorId,
    });
  },

  async updateProducto(uuid, payload, actorId) {
    const producto = await this.getProductoByUuid(uuid);

    if (payload.nombre) {
      const existing = await productoRepository.findByNombre(payload.nombre);
      if (existing && existing.id !== producto.id) {
        throw ApiError.conflict('Ya existe un producto con ese nombre');
      }
    }

    return productoRepository.update(producto, { ...payload, updatedBy: actorId });
  },

  async deleteProducto(uuid, actorId) {
    const producto = await this.getProductoByUuid(uuid);
    await productoRepository.softDelete(producto, actorId);
  },

  // Consulta los combos ACTIVOS de api-rest-banarica (sin escribir nada),
  // para que el usuario elija cuáles sincronizar. banarica no tiene un campo
  // `estado`/`activo`: usa `isBlock` (bloqueado) como bandera inversa, así
  // que "activo" = !isBlock.
  async fetchActiveBanaricaCombos() {
    const [baseUrl, apiKey] = await Promise.all([
      configuracionService.getBanaricaApiUrl(),
      configuracionService.getBanaricaApiKey(),
    ]);
    const url = `${baseUrl.replace(/\/$/, '')}/api/v1/combos/`;
    let combos;
    try {
      const response = await fetch(url, {
        headers: apiKey ? { api: apiKey } : {},
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      combos = await response.json();
    } catch (error) {
      logger.error('Error al consultar combos de Logística', { message: error.message });
      throw ApiError.internal('No se pudo consultar el API de Logística para sincronizar productos');
    }

    if (!Array.isArray(combos)) {
      throw ApiError.internal('Respuesta inesperada del API de Logística al listar combos');
    }

    return combos.filter((c) => !c.isBlock);
  },

  // Vista previa: lista los combos activos de Logística indicando si cada
  // uno ya existe como producto en Corbana, para que el usuario elija cuáles
  // sincronizar antes de escribir nada.
  async previewBanaricaCombos() {
    const activos = await this.fetchActiveBanaricaCombos();

    const items = await Promise.all(
      activos.map(async (combo) => {
        const nombre = String(combo.nombre || combo.consecutivo || '').trim();
        const existing = nombre ? await productoRepository.findByNombre(nombre) : null;
        return {
          consecutivo: String(combo.consecutivo ?? ''),
          nombre: nombre || String(combo.consecutivo ?? ''),
          yaSincronizado: Boolean(existing),
        };
      }),
    );

    return { items };
  },

  // Sincroniza como productos de Corbana solo los combos de Logística cuyos
  // `consecutivo` vengan en `consecutivos` (elegidos en el paso de vista
  // previa). Se empareja por NOMBRE (no por código): a diferencia de fincas,
  // el nombre del producto es el dato estable que se usa en Programación de
  // Corte para autocrear productos, así que re-sincronizar no debe duplicar
  // lo que ya se creó solo (ver programacionCorteService.resolverProductosPorNombre).
  async syncFromBanarica(actorId, consecutivos) {
    if (!Array.isArray(consecutivos) || consecutivos.length === 0) {
      throw ApiError.badRequest('Debes indicar al menos un producto a sincronizar');
    }

    const activos = await this.fetchActiveBanaricaCombos();
    const seleccionados = new Set(consecutivos.map(String));
    const combosElegidos = activos.filter((c) => seleccionados.has(String(c.consecutivo)));

    let creados = 0;
    let actualizados = 0;
    let restaurados = 0;

    for (const combo of combosElegidos) {
      const nombre = String(combo.nombre || combo.consecutivo || '').trim();
      if (!nombre) continue;

      const datos = {
        nombre,
        codigo: combo.consecutivo !== null && combo.consecutivo !== undefined ? String(combo.consecutivo) : null,
        pesoNeto: combo.peso_neto ?? null,
        pesoBruto: combo.peso_bruto ?? null,
        cajasPorPalet: combo.cajas_por_palet ?? null,
        cajasPorMinipalet: combo.cajas_por_mini_palet ?? null,
        cantidadPalets: combo.palets_por_contenedor ?? null,
        estado: true,
        updatedBy: actorId,
      };

      // Se busca incluyendo eliminados: el UNIQUE de `nombre` en la BD no
      // distingue soft-deletes, así que si ya existe (aunque esté borrado)
      // hay que restaurarlo/actualizarlo en vez de intentar crear otro.
      const existing = await productoRepository.findByNombreIncludingDeleted(nombre);

      if (existing && existing.deletedAt) {
        await productoRepository.restore(existing);
        await productoRepository.update(existing, datos);
        restaurados += 1;
      } else if (existing) {
        await productoRepository.update(existing, datos);
        actualizados += 1;
      } else {
        await productoRepository.create({ ...datos, createdBy: actorId });
        creados += 1;
      }
    }

    return {
      totalSeleccionados: combosElegidos.length,
      productosCreados: creados,
      productosActualizados: actualizados,
      productosRestaurados: restaurados,
    };
  },
};

export default productoService;
