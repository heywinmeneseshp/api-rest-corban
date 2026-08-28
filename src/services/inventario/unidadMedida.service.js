import { unidadMedidaRepository, unidadConversionRepository } from '../../repositories/inventario/unidadMedida.repository.js';
import { UnidadMedida, UnidadConversion } from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { assertSinDuplicado } from '../../utils/duplicadoGuard.js';
import { sequelize } from '../../database/connection.js';

export const unidadMedidaService = {
  async list(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await unidadMedidaRepository.findAndCountAll({
      limit,
      offset,
      search: query.search,
      tipo: query.tipo,
      estado: query.estado,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getByUuid(uuid) {
    const uni = await unidadMedidaRepository.findByUuid(uuid);
    if (!uni) throw ApiError.notFound('Unidad de medida no encontrada');
    return uni;
  },

  async create(payload, actorId) {
    return sequelize.transaction(async (t) => {
      await assertSinDuplicado(UnidadMedida, { codigo: payload.codigo }, t, 'Ya existe una unidad con ese código');
      return unidadMedidaRepository.create(
        {
          codigo: payload.codigo,
          nombre: payload.nombre,
          simbolo: payload.simbolo,
          tipo: payload.tipo || 'OTRO',
          estado: payload.estado ?? true,
          createdBy: actorId,
        },
        { transaction: t },
      );
    });
  },

  async update(uuid, payload, actorId) {
    const uni = await this.getByUuid(uuid);
    return sequelize.transaction(async (t) => {
      if (payload.codigo) {
        await assertSinDuplicado(UnidadMedida, { codigo: payload.codigo }, t, 'Ya existe una unidad con ese código', uni.id);
      }
      return unidadMedidaRepository.update(uni, { ...payload, updatedBy: actorId }, { transaction: t });
    });
  },

  async delete(uuid, actorId) {
    const uni = await this.getByUuid(uuid);
    await unidadMedidaRepository.softDelete(uni, actorId);
  },

  // Conversiones
  async listConversiones() {
    // simple list, no pagination for now
    return UnidadConversion.findAll({ include: [{ model: UnidadMedida, as: 'unidadOrigen' }, { model: UnidadMedida, as: 'unidadDestino' }] });
  },

  async createConversion(payload, actorId) {
    const origen = await UnidadMedida.findOne({ where: { uuid: payload.unidadOrigenUuid } });
    const destino = await UnidadMedida.findOne({ where: { uuid: payload.unidadDestinoUuid } });
    if (!origen || !destino) throw ApiError.notFound('Unidad origen o destino no encontrada');
    if (origen.id === destino.id) throw ApiError.badRequest('Origen y destino no pueden ser la misma unidad');

    const existente = await unidadConversionRepository.findByPar(payload.unidadOrigenUuid, payload.unidadDestinoUuid);
    if (existente) throw ApiError.conflict('Ya existe una conversión entre esas unidades');

    return unidadConversionRepository.create({
      unidadOrigenId: origen.id,
      unidadDestinoId: destino.id,
      factor: payload.factor,
      createdBy: actorId,
    });
  },

  async deleteConversion(uuid) {
    const conv = await unidadConversionRepository.findByUuid(uuid);
    if (!conv) throw ApiError.notFound('Conversión no encontrada');
    await unidadConversionRepository.delete(conv);
  },
};

export default unidadMedidaService;
