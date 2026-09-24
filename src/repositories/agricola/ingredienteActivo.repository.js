import { Op } from 'sequelize';
import { IngredienteActivo } from '../../database/associations.js';

export const ingredienteActivoRepository = {
  async findAndCountAll({ limit, offset, search, estado }) {
    const where = {
      ...(search
        ? {
            [Op.or]: [
              { nombre: { [Op.like]: `%${search}%` } },
              { descripcion: { [Op.like]: `%${search}%` } },
            ],
          }
        : {}),
      ...(estado !== undefined ? { estado } : {}),
    };

    return IngredienteActivo.findAndCountAll({ where, limit, offset, order: [['nombre', 'ASC']] });
  },

  findByUuid(uuid) {
    return IngredienteActivo.findOne({ where: { uuid } });
  },

  findById(id) {
    return IngredienteActivo.findByPk(id);
  },

  findByNombre(nombre) {
    return IngredienteActivo.findOne({ where: { nombre } });
  },

  create(data, { transaction } = {}) {
    return IngredienteActivo.create(data, { transaction });
  },

  async update(ingrediente, data, { transaction } = {}) {
    await ingrediente.update(data, { transaction });
    return ingrediente;
  },

  async softDelete(ingrediente, deletedBy, { transaction } = {}) {
    await ingrediente.update({ deletedBy }, { transaction });
    await ingrediente.destroy({ transaction });
    return ingrediente;
  },
};

export default ingredienteActivoRepository;
