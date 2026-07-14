import { Op } from 'sequelize';
import { TipoEvaluacion } from '../../database/associations.js';

export const tipoEvaluacionRepository = {
  async findAndCountAll({ limit, offset, search }) {
    const where = search
      ? {
          [Op.or]: [
            { nombre: { [Op.like]: `%${search}%` } },
            { descripcion: { [Op.like]: `%${search}%` } },
          ],
        }
      : undefined;

    return TipoEvaluacion.findAndCountAll({ where, limit, offset, order: [['id', 'ASC']] });
  },

  findByUuid(uuid) {
    return TipoEvaluacion.findOne({ where: { uuid } });
  },

  findById(id) {
    return TipoEvaluacion.findByPk(id);
  },

  findByNombre(nombre) {
    return TipoEvaluacion.findOne({ where: { nombre } });
  },

  create(data, { transaction } = {}) {
    return TipoEvaluacion.create(data, { transaction });
  },

  async update(tipo, data, { transaction } = {}) {
    await tipo.update(data, { transaction });
    return tipo;
  },

  async softDelete(tipo, deletedBy, { transaction } = {}) {
    await tipo.update({ deletedBy }, { transaction });
    await tipo.destroy({ transaction });
    return tipo;
  },
};

export default tipoEvaluacionRepository;
