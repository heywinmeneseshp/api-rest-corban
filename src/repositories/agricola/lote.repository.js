import { Op } from 'sequelize';
import { Lote, Planta } from '../../database/associations.js';

export const loteRepository = {
  async findAndCountAll({ limit, offset, search, fincaId }) {
    const where = {
      ...(fincaId ? { fincaId } : {}),
      ...(search
        ? {
            [Op.or]: [
              { codigo: { [Op.like]: `%${search}%` } },
              { nombre: { [Op.like]: `%${search}%` } },
            ],
          }
        : {}),
    };

    return Lote.findAndCountAll({ where, limit, offset, order: [['id', 'ASC']] });
  },

  findByUuid(uuid) {
    return Lote.findOne({ where: { uuid } });
  },

  findById(id) {
    return Lote.findByPk(id);
  },

  findByFincaAndCodigo(fincaId, codigo) {
    return Lote.findOne({ where: { fincaId, codigo } });
  },

  // Cuenta TODOS los lotes de la finca, incluidos los eliminados
  // lógicamente, para generar un consecutivo que nunca se repita.
  countByFincaId(fincaId) {
    return Lote.count({ where: { fincaId }, paranoid: false });
  },

  create(data, { transaction } = {}) {
    return Lote.create(data, { transaction });
  },

  async update(lote, data, { transaction } = {}) {
    await lote.update(data, { transaction });
    return lote;
  },

  async softDelete(lote, deletedBy, { transaction } = {}) {
    await lote.update({ deletedBy }, { transaction });
    await lote.destroy({ transaction });
    return lote;
  },

  findPlantasByLoteId(loteId, { limit, offset } = {}) {
    return Planta.findAndCountAll({ where: { loteId }, limit, offset, order: [['id', 'ASC']] });
  },
};

export default loteRepository;
