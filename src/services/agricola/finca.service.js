import { fincaRepository } from '../../repositories/agricola/finca.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { logger } from '../../utils/logger.js';
import { configuracionService } from '../sistema/configuracion.service.js';

export const fincaService = {
  async listFincas(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await fincaRepository.findAndCountAll({
      limit,
      offset,
      search: query.search,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getFincaByUuid(uuid) {
    const finca = await fincaRepository.findByUuid(uuid);
    if (!finca) throw ApiError.notFound('Finca no encontrada');
    return finca;
  },

  async createFinca(payload, actorId) {
    const existing = await fincaRepository.findByCodigo(payload.codigo);
    if (existing) throw ApiError.conflict('Ya existe una finca con ese código');

    return fincaRepository.create({
      codigo: payload.codigo,
      nombre: payload.nombre,
      estado: payload.estado ?? true,
      createdBy: actorId,
    });
  },

  async updateFinca(uuid, payload, actorId) {
    const finca = await this.getFincaByUuid(uuid);

    if (payload.codigo) {
      const existing = await fincaRepository.findByCodigo(payload.codigo);
      if (existing && existing.id !== finca.id) {
        throw ApiError.conflict('Ya existe una finca con ese código');
      }
    }

    return fincaRepository.update(finca, { ...payload, updatedBy: actorId });
  },

  async deleteFinca(uuid, actorId) {
    const finca = await this.getFincaByUuid(uuid);
    await fincaRepository.softDelete(finca, actorId);
  },

  async listLotes(uuid, query) {
    const finca = await this.getFincaByUuid(uuid);
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await fincaRepository.findLotesByFincaId(finca.id, { limit, offset });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  // Consulta los almacenes ACTIVOS de api-rest-banarica (sin escribir nada),
  // para que el usuario elija cuáles sincronizar. banarica no tiene un campo
  // `estado`/`activo`: usa `isBlock` (bloqueado) como bandera inversa, así
  // que "activo" = !isBlock.
  async fetchActiveBanaricaAlmacenes() {
    const baseUrl = await configuracionService.getBanaricaApiUrl();
    const url = `${baseUrl.replace(/\/$/, '')}/api/v1/almacenes/`;
    let almacenes;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      almacenes = await response.json();
    } catch (error) {
      logger.error('Error al consultar almacenes de banarica', { message: error.message });
      throw ApiError.internal('No se pudo consultar el API de banarica para sincronizar almacenes');
    }

    if (!Array.isArray(almacenes)) {
      throw ApiError.internal('Respuesta inesperada del API de banarica al listar almacenes');
    }

    return almacenes.filter((a) => !a.isBlock);
  },

  // Vista previa: lista los almacenes activos de banarica indicando si cada
  // uno ya existe como finca en corbana, para que el usuario elija cuáles
  // sincronizar antes de escribir nada.
  async previewBanaricaAlmacenes() {
    const activos = await this.fetchActiveBanaricaAlmacenes();

    const items = await Promise.all(
      activos.map(async (almacen) => {
        const codigo = String(almacen.consecutivo);
        const existing = await fincaRepository.findByCodigo(codigo);
        return {
          consecutivo: codigo,
          nombre: almacen.nombre || codigo,
          yaSincronizado: Boolean(existing),
        };
      }),
    );

    return { items };
  },

  // Sincroniza como fincas de corbana solo los almacenes de banarica cuyos
  // `consecutivo` vengan en `consecutivos` (elegidos por el usuario en el
  // paso de vista previa). El `consecutivo` se usa como `codigo` de la
  // finca para poder emparejar registros en re-sincronizaciones.
  async syncFromBanarica(actorId, consecutivos) {
    if (!Array.isArray(consecutivos) || consecutivos.length === 0) {
      throw ApiError.badRequest('Debes indicar al menos un almacén a sincronizar');
    }

    const activos = await this.fetchActiveBanaricaAlmacenes();
    const seleccionados = new Set(consecutivos.map(String));
    const almacenesElegidos = activos.filter((a) => seleccionados.has(String(a.consecutivo)));

    let creados = 0;
    let actualizados = 0;
    let restaurados = 0;

    for (const almacen of almacenesElegidos) {
      const codigo = String(almacen.consecutivo);
      const nombre = almacen.nombre || codigo;
      // Se busca incluyendo eliminados: el UNIQUE de `codigo` en la BD no
      // distingue soft-deletes, así que si ya existe (aunque esté borrada)
      // hay que restaurarla/actualizarla en vez de intentar crear otra.
      const existing = await fincaRepository.findByCodigoIncludingDeleted(codigo);

      if (existing && existing.deletedAt) {
        await fincaRepository.restore(existing);
        await fincaRepository.update(existing, { nombre, estado: true, updatedBy: actorId });
        restaurados += 1;
      } else if (existing) {
        await fincaRepository.update(existing, { nombre, estado: true, updatedBy: actorId });
        actualizados += 1;
      } else {
        await fincaRepository.create({ codigo, nombre, estado: true, createdBy: actorId });
        creados += 1;
      }
    }

    return {
      totalSeleccionados: almacenesElegidos.length,
      fincasCreadas: creados,
      fincasActualizadas: actualizados,
      fincasRestauradas: restaurados,
    };
  },
};

export default fincaService;
