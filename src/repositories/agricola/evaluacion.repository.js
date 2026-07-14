import {
  Evaluacion,
  Planta,
  User,
  TipoEvaluacion,
  Semana,
  Infeccion,
  ConteoHojas,
  SumaBruta,
} from '../../database/associations.js';

const defaultIncludes = [
  { model: Planta, as: 'planta', attributes: ['id', 'uuid', 'codigo'] },
  { model: User, as: 'usuario', attributes: ['id', 'uuid', 'usuario', 'nombre', 'apellido'] },
  { model: TipoEvaluacion, as: 'tipoEvaluacion', attributes: ['id', 'uuid', 'nombre'] },
  { model: Semana, as: 'semana', attributes: ['id', 'uuid', 'codigo'] },
];

export const evaluacionRepository = {
  async findAndCountAll({ limit, offset, plantaId, fechaDesde, fechaHasta }) {
    const where = {};
    if (plantaId) where.plantaId = plantaId;
    if (fechaDesde || fechaHasta) {
      const { Op } = await import('sequelize');
      where.fecha = {};
      if (fechaDesde) where.fecha[Op.gte] = fechaDesde;
      if (fechaHasta) where.fecha[Op.lte] = fechaHasta;
    }

    return Evaluacion.findAndCountAll({
      where,
      limit,
      offset,
      order: [['fecha', 'DESC']],
      include: defaultIncludes,
    });
  },

  findByUuid(uuid) {
    return Evaluacion.findOne({
      where: { uuid },
      include: [
        ...defaultIncludes,
        { model: Infeccion, as: 'infeccion' },
        { model: ConteoHojas, as: 'conteoHojas' },
        { model: SumaBruta, as: 'sumaBruta' },
      ],
    });
  },

  findById(id) {
    return Evaluacion.findByPk(id);
  },

  create(data, { transaction } = {}) {
    return Evaluacion.create(data, { transaction });
  },

  async update(evaluacion, data, { transaction } = {}) {
    await evaluacion.update(data, { transaction });
    return evaluacion;
  },

  async softDelete(evaluacion, actorId, { transaction } = {}) {
    await evaluacion.update({ estado: false, updatedBy: actorId }, { transaction });
    return evaluacion;
  },
};

export default evaluacionRepository;
