import { Op } from 'sequelize';
import { GrupoFinca, Finca } from '../../database/associations.js';

export const grupoFincaRepository = {
  async findAndCountAll({ limit, offset, search }) {
    const where = search ? { nombre: { [Op.like]: `%${search}%` } } : undefined;
    return GrupoFinca.findAndCountAll({ where, limit, offset, order: [['nombre', 'ASC']] });
  },
  findByUuid(uuid) {
    return GrupoFinca.findOne({ where: { uuid }, include: [{ model: Finca, as: 'fincas' }] });
  },
  findById(id) {
    return GrupoFinca.findByPk(id);
  },
  findByNombre(nombre) {
    return GrupoFinca.findOne({ where: { nombre } });
  },
  findAll() {
    return GrupoFinca.findAll({ order: [['nombre', 'ASC']] });
  },
  create(data, { transaction } = {}) {
    return GrupoFinca.create(data, { transaction });
  },
  async update(grupo, data, { transaction } = {}) {
    await grupo.update(data, { transaction });
    return grupo;
  },
  async softDelete(grupo, deletedBy, { transaction } = {}) {
    await grupo.update({ deletedBy }, { transaction });
    await grupo.destroy({ transaction });
    return grupo;
  },
};

export default grupoFincaRepository;
