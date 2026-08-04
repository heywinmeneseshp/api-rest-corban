import { Op } from 'sequelize';
import { Labor, CategoriaLabor } from '../../database/associations.js';

export const laborRepository = {
  async findAndCountAll({ limit, offset, search, categoriaLaborId }) {
    const where = {
      ...(categoriaLaborId ? { categoriaLaborId } : {}),
      ...(search ? { nombre: { [Op.like]: `%${search}%` } } : {}),
    };

    return Labor.findAndCountAll({
      where,
      limit,
      offset,
      order: [['nombre', 'ASC']],
      include: [{ model: CategoriaLabor, as: 'categoria' }],
    });
  },

  findByUuid(uuid) {
    return Labor.findOne({ where: { uuid }, include: [{ model: CategoriaLabor, as: 'categoria' }] });
  },

  findById(id) {
    return Labor.findByPk(id);
  },

  findByCategoriaAndNombre(categoriaLaborId, nombre) {
    return Labor.findOne({ where: { categoriaLaborId, nombre } });
  },

  findAll() {
    return Labor.findAll({ order: [['nombre', 'ASC']], include: [{ model: CategoriaLabor, as: 'categoria' }] });
  },

  create(data, { transaction } = {}) {
    return Labor.create(data, { transaction });
  },

  async update(labor, data, { transaction } = {}) {
    await labor.update(data, { transaction });
    return labor;
  },

  async softDelete(labor, deletedBy, { transaction } = {}) {
    await labor.update({ deletedBy }, { transaction });
    await labor.destroy({ transaction });
    return labor;
  },
};

export default laborRepository;
