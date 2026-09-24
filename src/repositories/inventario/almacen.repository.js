import { Op } from 'sequelize';
import { Almacen, Finca, User } from '../../database/associations.js';

const INCLUDE = [
  { model: Almacen, as: 'padre', attributes: ['uuid', 'nombre'] },
  { model: Finca, as: 'finca', attributes: ['uuid', 'nombre', 'codigo'] },
  { model: User, as: 'responsable', attributes: ['uuid', 'usuario', 'nombre', 'apellido'] },
];

export const almacenRepository = {
  async findAndCountAll({ limit, offset, search, tipo, parentUuid, estado, almacenIdsPermitidos }) {
    const where = {
      ...(search ? { nombre: { [Op.like]: `%${search}%` } } : {}),
      ...(tipo ? { tipo } : {}),
      ...(estado !== undefined ? { estado } : {}),
      ...(almacenIdsPermitidos !== null && almacenIdsPermitidos !== undefined
        ? { id: { [Op.in]: almacenIdsPermitidos } }
        : {}),
    };

    if (parentUuid) {
      const padre = await Almacen.findOne({ where: { uuid: parentUuid } });
      where.parentId = padre ? padre.id : null;
    }

    return Almacen.findAndCountAll({ where, limit, offset, order: [['nombre', 'ASC']], include: INCLUDE });
  },

  async findAllTree(almacenIdsPermitidos) {
    const where = {
      estado: true,
      ...(almacenIdsPermitidos !== null && almacenIdsPermitidos !== undefined
        ? { id: { [Op.in]: almacenIdsPermitidos } }
        : {}),
    };
    return Almacen.findAll({ where, order: [['nombre', 'ASC']], include: INCLUDE });
  },

  findByUuid(uuid) {
    return Almacen.findOne({ where: { uuid }, include: INCLUDE });
  },

  findById(id) {
    return Almacen.findByPk(id);
  },

  create(data, { transaction } = {}) {
    return Almacen.create(data, { transaction });
  },

  async update(almacen, data, { transaction } = {}) {
    await almacen.update(data, { transaction });
    return almacen;
  },

  async softDelete(almacen, deletedBy, { transaction } = {}) {
    await almacen.update({ deletedBy }, { transaction });
    await almacen.destroy({ transaction });
    return almacen;
  },
};

export default almacenRepository;
