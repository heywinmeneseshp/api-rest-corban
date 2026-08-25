import { Op } from 'sequelize';
import { ProgramacionMantenimiento, PlanMantenimiento, Equipo, User } from '../../database/associations.js';

const INCLUDE = [
  { model: PlanMantenimiento, as: 'plan', attributes: ['uuid', 'nombre', 'tipo', 'periodicidadValor', 'periodicidadUnidad'] },
  { model: Equipo, as: 'equipo', attributes: ['uuid', 'codigo', 'nombre', 'tipo', 'estado'] },
  { model: User, as: 'responsable', attributes: ['uuid', 'usuario', 'nombre'] },
];

export const programacionMantenimientoRepository = {
  async findAndCountAll({ limit, offset, equipoUuid, planUuid, estado, prioridad, fechaDesde, fechaHasta }) {
    const where = {};
    if (estado) where.estado = estado;
    if (prioridad) where.prioridad = prioridad;
    if (fechaDesde || fechaHasta) {
      where.fechaProgramada = {};
      if (fechaDesde) where.fechaProgramada[Op.gte] = fechaDesde;
      if (fechaHasta) where.fechaProgramada[Op.lte] = fechaHasta;
    }
    if (equipoUuid) {
      const eq = await Equipo.findOne({ where: { uuid: equipoUuid } });
      where.equipoId = eq ? eq.id : -1;
    }
    if (planUuid) {
      const pl = await PlanMantenimiento.findOne({ where: { uuid: planUuid } });
      where.planId = pl ? pl.id : -1;
    }
    return ProgramacionMantenimiento.findAndCountAll({
      where,
      limit,
      offset,
      order: [['fechaProgramada', 'DESC']],
      include: INCLUDE,
      distinct: true,
    });
  },

  findByUuid(uuid) {
    return ProgramacionMantenimiento.findOne({ where: { uuid }, include: INCLUDE });
  },

  create(data, { transaction } = {}) {
    return ProgramacionMantenimiento.create(data, { transaction });
  },

  async update(prog, data, { transaction } = {}) {
    await prog.update(data, { transaction });
    return prog;
  },

  async softDelete(prog, deletedBy, { transaction } = {}) {
    await prog.update({ deletedBy }, { transaction });
    await prog.destroy({ transaction });
    return prog;
  },

  // Para dashboard: próximos mantenimientos
  findProximos(limite = 5) {
    return ProgramacionMantenimiento.findAll({
      where: { estado: ['PENDIENTE', 'PROGRAMADA'] },
      order: [['fechaProgramada', 'ASC']],
      limit: limite,
      include: INCLUDE,
    });
  },
};

export default programacionMantenimientoRepository;
