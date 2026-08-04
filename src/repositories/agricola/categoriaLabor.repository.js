import { Op } from 'sequelize';
import { CategoriaLabor } from '../../database/associations.js';

export const categoriaLaborRepository = {
  async findAndCountAll({ limit, offset, search }) {
    const where = search ? { nombre: { [Op.like]: `%${search}%` } } : undefined;
    return CategoriaLabor.findAndCountAll({ where, limit, offset, order: [['orden', 'ASC'], ['nombre', 'ASC']] });
  },

  findByUuid(uuid) {
    return CategoriaLabor.findOne({ where: { uuid } });
  },

  findById(id) {
    return CategoriaLabor.findByPk(id);
  },

  findByNombre(nombre) {
    return CategoriaLabor.findOne({ where: { nombre } });
  },

  findAll() {
    return CategoriaLabor.findAll({ order: [['orden', 'ASC'], ['nombre', 'ASC']] });
  },

  create(data, { transaction } = {}) {
    return CategoriaLabor.create(data, { transaction });
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

export default categoriaLaborRepository;
