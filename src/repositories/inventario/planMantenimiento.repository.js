import { Op } from 'sequelize';
import { PlanMantenimiento, Equipo, User } from '../../database/associations.js';

const INCLUDE = [
  { model: Equipo, as: 'equipo', attributes: ['uuid', 'codigo', 'nombre', 'tipo', 'estado'] },
  { model: User, as: 'creadoPor', attributes: ['uuid', 'usuario'] },
];

export const planMantenimientoRepository = {
  async findAndCountAll({ limit, offset, equipoUuid, tipo, estado, search }) {
    const where = {};
    if (search) where.nombre = { [Op.like]: `%${search}%` };
    if (tipo) where.tipo = tipo;
    if (estado !== undefined) where.estado = estado;
    if (equipoUuid) {
      const eq = await Equipo.findOne({ where: { uuid: equipoUuid } });
      where.equipoId = eq ? eq.id : -1;
    }
    return PlanMantenimiento.findAndCountAll({
      where,
      limit,
      offset,
      order: [['created_at', 'DESC']],
      include: INCLUDE,
      distinct: true,
    });
  },

  findByUuid(uuid) {
    return PlanMantenimiento.findOne({ where: { uuid }, include: INCLUDE });
  },

  create(data, { transaction } = {}) {
    return PlanMantenimiento.create(data, { transaction });
  },

  async update(plan, data, { transaction } = {}) {
    await plan.update(data, { transaction });
    return plan;
  },

  async softDelete(plan, deletedBy, { transaction } = {}) {
    await plan.update({ deletedBy }, { transaction });
    await plan.destroy({ transaction });
    return plan;
  },
};

export default planMantenimientoRepository;
