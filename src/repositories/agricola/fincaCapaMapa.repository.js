import { FincaCapaMapa, Lote } from '../../database/associations.js';

export const fincaCapaMapaRepository = {
  findAllByFinca(fincaId, { categoria } = {}) {
    return FincaCapaMapa.findAll({
      where: { fincaId, ...(categoria ? { categoria } : {}) },
      include: [{ model: Lote, as: 'lote', attributes: ['uuid', 'codigo', 'nombre'], required: false }],
      order: [['categoria', 'ASC'], ['id', 'ASC']],
    });
  },

  // Soft-delete de todo lo de esa finca+categoría (con deleted_by para auditar).
  async borrarPorCategoria(fincaId, categoria, deletedBy, { transaction } = {}) {
    await FincaCapaMapa.update({ deletedBy }, { where: { fincaId, categoria }, transaction });
    return FincaCapaMapa.destroy({ where: { fincaId, categoria }, transaction });
  },

  bulkCreate(filas, { transaction } = {}) {
    return FincaCapaMapa.bulkCreate(filas, { transaction });
  },
};

export default fincaCapaMapaRepository;
