import { sequelize } from '../../database/connection.js';
import { comprobanteAspersionRepository } from '../../repositories/agricola/comprobanteAspersion.repository.js';
import { ComprobanteAspersion, MezclaVersion, MezclaComponente, UnidadMedida } from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { generarCorrelativo } from '../../utils/correlativo.js';
import { resolverFactorConversion } from '../../utils/unidadConversion.js';
import { ordenarComponentesReceta } from '../../utils/ordenReceta.js';
import { getAlmacenIdsPermitidas } from '../../utils/almacenScope.js';

const PREFIJO = 'CMP';

// articuloId del insumo principal de la receta ACTIVA de cada mezcla — el
// comprobante lista los insumos con el principal primero (mismo orden que
// toda la API, ver utils/ordenReceta.js).
async function mapaPrincipales(mezclaIds) {
  const ids = [...new Set(mezclaIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const versiones = await MezclaVersion.findAll({
    where: { mezclaId: ids, activa: true },
    include: [{ model: MezclaComponente, as: 'componentes', where: { esPrincipal: true }, required: false, attributes: ['articuloId'] }],
  });
  return new Map(versiones.map((v) => [v.mezclaId, v.componentes?.[0]?.articuloId ?? null]));
}

// El comprobante muestra NOMBRES de insumos, nunca cantidades (pedido
// explícito) — `aspersion.componentes` (con sus cantidades) no sale en la
// respuesta; solo `insumos`.
function aDto(comprobante, principalArticuloId) {
  const json = comprobante.toJSON();
  const componentes = json.aspersion?.componentes || [];
  json.insumos = ordenarComponentesReceta(componentes, principalArticuloId).map((c) => ({
    nombre: c.articulo?.nombre || '—',
    esPrincipal: principalArticuloId !== null && principalArticuloId !== undefined && c.articuloId === principalArticuloId,
  }));
  if (json.aspersion) delete json.aspersion.componentes;
  return json;
}

async function cargarOFallar(uuid, user) {
  const comprobante = await comprobanteAspersionRepository.findByUuid(uuid);
  if (!comprobante) throw ApiError.notFound('Comprobante de aspersión no encontrado');
  const permitidos = getAlmacenIdsPermitidas(user);
  if (permitidos !== null && !permitidos.includes(comprobante.aspersion?.almacenId)) {
    throw ApiError.notFound('Comprobante de aspersión no encontrado');
  }
  return comprobante;
}

function assertBorrador(comprobante) {
  if (comprobante.estado !== 'BORRADOR') {
    throw ApiError.badRequest('Un comprobante ya emitido no se puede modificar');
  }
}

// Galones totales de la mezcla: la "cantidad a preparar" de la aspersión
// (en la unidad de rendimiento de la mezcla) llevada a Galones. Null si no
// hay conversión — se completa a mano en el comprobante.
async function galonesDeAspersion(aspersion, { transaction } = {}) {
  const unidadId = aspersion.mezcla?.unidadRendimientoId;
  if (!unidadId) return null;
  const galon = await UnidadMedida.findOne({ where: { nombre: 'Galón' }, transaction });
  if (!galon) return null;
  const factor = await resolverFactorConversion(unidadId, galon.id, { transaction });
  if (factor === null) return null;
  return Math.round(Number(aspersion.cantidadCalculada) * factor * 100) / 100;
}

export const comprobanteAspersionService = {
  // Se llama desde aspersionProgramacion.service.js#ejecutar, dentro de la
  // MISMA transacción: ejecutar la aspersión y crear su comprobante en
  // BORRADOR son una sola operación. `datos` viene del modal de ejecutar
  // (piloto, hectáreas aplicadas, galones, observaciones) y es opcional.
  async crearBorradorDesdeEjecucion(aspersion, datos, actorId, { transaction } = {}) {
    const existente = await ComprobanteAspersion.findOne({ where: { aspersionProgramacionId: aspersion.id }, transaction });
    if (existente) return existente;

    const galonesAuto = await galonesDeAspersion(aspersion, { transaction });
    const numero = await generarCorrelativo(ComprobanteAspersion, { prefijo: PREFIJO, columna: 'numero', transaction });
    return comprobanteAspersionRepository.create(
      {
        numero,
        aspersionProgramacionId: aspersion.id,
        estado: 'BORRADOR',
        medio: aspersion.medio || null,
        piloto: datos?.piloto?.trim() || null,
        hectareasProgramadas: aspersion.hectareas,
        hectareasAplicadas: datos?.hectareasAplicadas ?? aspersion.hectareas,
        galonesTotales: datos?.galonesTotales ?? galonesAuto,
        observaciones: datos?.observaciones?.trim() || null,
        ejecutadoPorId: actorId,
        ejecutadoEn: new Date(),
        createdBy: actorId,
      },
      { transaction },
    );
  },

  async list(query, user) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await comprobanteAspersionRepository.findAndCountAll({
      limit,
      offset,
      estado: query.estado,
      fincaUuid: query.fincaUuid,
      semanaUuid: query.semanaUuid,
      search: query.search,
      fechaDesde: query.fechaDesde,
      fechaHasta: query.fechaHasta,
      almacenIdsPermitidos: getAlmacenIdsPermitidas(user),
    });
    const principales = await mapaPrincipales(rows.map((r) => r.aspersion?.mezcla?.id));
    const items = rows.map((r) => aDto(r, principales.get(r.aspersion?.mezcla?.id) ?? null));
    return { items, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getByUuid(uuid, user) {
    const comprobante = await cargarOFallar(uuid, user);
    const principales = await mapaPrincipales([comprobante.aspersion?.mezclaId]);
    return aDto(comprobante, principales.get(comprobante.aspersion?.mezclaId) ?? null);
  },

  async update(uuid, payload, actorId, user) {
    const comprobante = await cargarOFallar(uuid, user);
    assertBorrador(comprobante);

    const data = { updatedBy: actorId };
    if (payload.piloto !== undefined) data.piloto = payload.piloto?.trim() || null;
    if (payload.medio !== undefined) data.medio = payload.medio || null;
    if (payload.hectareasAplicadas !== undefined) data.hectareasAplicadas = payload.hectareasAplicadas;
    if (payload.galonesTotales !== undefined) data.galonesTotales = payload.galonesTotales;
    if (payload.observaciones !== undefined) data.observaciones = payload.observaciones?.trim() || null;

    await comprobanteAspersionRepository.update(comprobante, data);
    return this.getByUuid(uuid, user);
  },

  async emitir(uuid, actorId, user) {
    const comprobante = await cargarOFallar(uuid, user);
    assertBorrador(comprobante);
    if (!comprobante.piloto?.trim() || !(Number(comprobante.hectareasAplicadas) > 0)) {
      throw ApiError.badRequest('Completa el piloto y las hectáreas aplicadas antes de emitir el comprobante');
    }
    await comprobanteAspersionRepository.update(comprobante, {
      estado: 'EMITIDO',
      emitidoPorId: actorId,
      emitidoEn: new Date(),
      updatedBy: actorId,
    });
    return this.getByUuid(uuid, user);
  },

  async remove(uuid, actorId, user) {
    const comprobante = await cargarOFallar(uuid, user);
    assertBorrador(comprobante);
    await sequelize.transaction(async (t) => {
      await comprobanteAspersionRepository.softDelete(comprobante, actorId, { transaction: t });
    });
    return { uuid };
  },
};

export default comprobanteAspersionService;
