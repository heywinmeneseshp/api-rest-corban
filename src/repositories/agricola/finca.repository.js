import { Op } from 'sequelize';
import { Finca, Lote } from '../../database/associations.js';

export const fincaRepository = {
  async findAndCountAll({ limit, offset, search }) {
    const where = search
      ? {
          [Op.or]: [
            { codigo: { [Op.like]: `%${search}%` } },
            { nombre: { [Op.like]: `%${search}%` } },
          ],
        }
      : undefined;

    return Finca.findAndCountAll({ where, limit, offset, order: [['id', 'ASC']] });
  },

  findByUuid(uuid) {
    return Finca.findOne({ where: { uuid } });
  },

  findById(id) {
    return Finca.findByPk(id);
  },

  findByCodigo(codigo) {
    return Finca.findOne({ where: { codigo } });
  },

  create(data, { transaction } = {}) {
    return Finca.create(data, { transaction });
  },

  async update(finca, data, { transaction } = {}) {
    await finca.update(data, { transaction });
    return finca;
  },

  async softDelete(finca, deletedBy, { transaction } = {}) {
    await finca.update({ deletedBy }, { transaction });
    await finca.destroy({ transaction });
    return finca;
  },

  findLotesByFincaId(fincaId, { limit, offset } = {}) {
    return Lote.findAndCountAll({ where: { fincaId }, limit, offset, order: [['id', 'ASC']] });
  },
};

export default fincaRepository;
