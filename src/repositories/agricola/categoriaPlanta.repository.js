import { Op } from 'sequelize';
import { CategoriaPlanta } from '../../database/associations.js';

export const categoriaPlantaRepository = {
  async findAndCountAll({ limit, offset, search }) {
    const where = search
      ? {
          [Op.or]: [
            { nombre: { [Op.like]: `%${search}%` } },
            { descripcion: { [Op.like]: `%${search}%` } },
          ],
        }
      : undefined;

    return CategoriaPlanta.findAndCountAll({ where, limit, offset, order: [['id', 'ASC']] });
  },

  findByUuid(uuid) {
    return CategoriaPlanta.findOne({ where: { uuid } });
  },

  findById(id) {
    return CategoriaPlanta.findByPk(id);
  },

  findByNombre(nombre) {
    return CategoriaPlanta.findOne({ where: { nombre } });
  },

  create(data, { transaction } = {}) {
    return CategoriaPlanta.create(data, { transaction });
  },

  async update(categoria, data, { transaction } = {}) {
    await categoria.update(data, { transaction });
    return categoria;
  },

  async softDelete(categoria, deletedBy, { transaction } = {}) {
    await categoria.update({ deletedBy }, { transaction });
    await categoria.destroy({ transaction });
    return categoria;
  },
};

export default categoriaPlantaRepository;
