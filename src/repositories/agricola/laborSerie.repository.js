import { LaborSerie, LaborSerieLote, Labor, Finca, Lote, CategoriaLabor, User } from '../../database/associations.js';

export const laborSerieRepository = {
  create(data, { transaction } = {}) {
    return LaborSerie.create(data, { transaction });
  },

  // Guarda la lista ordenada de lotes de una serie en modo ROTACION/SIMULTANEO.
  createLotesRotacion(laborSerieId, loteIds, { transaction } = {}) {
    return LaborSerieLote.bulkCreate(
      loteIds.map((loteId, orden) => ({ laborSerieId, loteId, orden })),
      { transaction },
    );
  },

  findByUuid(uuid) {
    return LaborSerie.findOne({
      where: { uuid },
      include: [
        { model: Labor, as: 'labor', include: [{ model: CategoriaLabor, as: 'categoria' }] },
        { model: Finca, as: 'finca' },
        { model: Lote, as: 'lote' },
        { model: User, as: 'responsable' },
        { model: LaborSerieLote, as: 'lotesRotacion', include: [{ model: Lote, as: 'lote' }] },
      ],
    });
  },

  findById(id) {
    return LaborSerie.findByPk(id);
  },

  async update(serie, data, { transaction } = {}) {
    await serie.update(data, { transaction });
    return serie;
  },

  async softDelete(serie, deletedBy, { transaction } = {}) {
    await serie.update({ deletedBy }, { transaction });
    await serie.destroy({ transaction });
    return serie;
  },
};

export default laborSerieRepository;
