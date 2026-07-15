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

  // Incluye fincas eliminadas lógicamente (paranoid: false). El UNIQUE de
  // `codigo` en la BD no distingue registros con soft-delete, así que hay
  // que revisar esto antes de crear para no chocar con la restricción.
  findByCodigoIncludingDeleted(codigo) {
    return Finca.findOne({ where: { codigo }, paranoid: false });
  },

  async restore(finca, { transaction } = {}) {
    await finca.restore({ transaction });
    return finca;
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
