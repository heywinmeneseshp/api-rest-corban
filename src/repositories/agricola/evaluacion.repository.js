import { Op } from 'sequelize';
import {
  Evaluacion,
  Planta,
  User,
  TipoEvaluacion,
  Semana,
  Infeccion,
  ConteoHojas,
  SumaBruta,
  Lote,
  Finca,
} from '../../database/associations.js';

// `fincaId`/`loteId` filtran vía join anidado Planta -> Lote -> Finca.
// `required` se activa en cascada solo si hay algún filtro de finca/lote,
// para que la condición anidada realmente se aplique (INNER JOIN); sin
// filtro, todo queda opcional (LEFT JOIN) como antes.
const buildIncludes = ({ fincaId, fincaIds, loteId } = {}) => {
  const filtrandoUbicacion = Boolean(fincaId || fincaIds || loteId);
  const fincaWhere = fincaId ? { id: fincaId } : fincaIds ? { id: { [Op.in]: fincaIds } } : undefined;
  return [
    {
      model: Planta,
      as: 'planta',
      attributes: ['id', 'uuid', 'codigo'],
      required: filtrandoUbicacion,
      include: [
        {
          model: Lote,
          as: 'lote',
          attributes: ['id', 'uuid', 'codigo', 'nombre'],
          where: loteId ? { id: loteId } : undefined,
          required: filtrandoUbicacion,
          include: [
            {
              model: Finca,
              as: 'finca',
              attributes: ['id', 'uuid', 'codigo', 'nombre'],
              where: fincaWhere,
              required: Boolean(fincaWhere),
            },
          ],
        },
      ],
    },
    { model: User, as: 'usuario', attributes: ['id', 'uuid', 'usuario', 'nombre', 'apellido'] },
    { model: TipoEvaluacion, as: 'tipoEvaluacion', attributes: ['id', 'uuid', 'nombre'] },
    { model: Semana, as: 'semana', attributes: ['id', 'uuid', 'codigo'] },
    { model: Infeccion, as: 'infeccion', include: [{ association: 'hojas' }] },
    { model: ConteoHojas, as: 'conteoHojas' },
    { model: SumaBruta, as: 'sumaBruta', include: [{ association: 'estadios' }] },
  ];
};

export const evaluacionRepository = {
  async findAndCountAll({
    limit,
    offset,
    plantaId,
    fechaDesde,
    fechaHasta,
    fincaId,
    fincaIds,
    loteId,
    semanaId,
    usuarioId,
    tipoEvaluacionId,
  }) {
    const where = {};
    if (plantaId) where.plantaId = plantaId;
    if (tipoEvaluacionId) where.tipoEvaluacionId = tipoEvaluacionId;
    if (semanaId) where.semanaId = semanaId;
    if (usuarioId) where.usuarioId = usuarioId;
    if (fechaDesde || fechaHasta) {
      where.fecha = {};
      if (fechaDesde) where.fecha[Op.gte] = fechaDesde;
      if (fechaHasta) where.fecha[Op.lte] = fechaHasta;
    }

    return Evaluacion.findAndCountAll({
      where,
      limit,
      offset,
      order: [['fecha', 'DESC']],
      include: buildIncludes({ fincaId, fincaIds, loteId }),
      distinct: true,
    });
  },

  findByUuid(uuid, { fincaIds } = {}) {
    return Evaluacion.findOne({
      where: { uuid },
      include: buildIncludes({ fincaIds }),
    });
  },

  // Evaluaciones con sus asociaciones (incluida la semana) para promedios
  // por semana. `anio`/`semanaId` filtran por la semana (año, o una semana
  // puntual); `fincaId`/`fincaIds` filtran por ubicación.
  async findAllPorSemana({ fincaId, fincaIds, anio, semanaId, loteId }) {
    const includes = buildIncludes({ fincaId, fincaIds, loteId }).map((inc) => {
      if (inc.as === 'semana') {
        return {
          model: Semana,
          as: 'semana',
          attributes: ['id', 'uuid', 'codigo', 'numeroSemana', 'anio', 'fechaInicio', 'color'],
          where: anio ? { anio } : semanaId ? { id: semanaId } : undefined,
        };
      }
      if (inc.as === 'conteoHojas') {
        return {
          model: ConteoHojas,
          as: 'conteoHojas',
          include: [
            {
              model: Semana,
              as: 'semanaEmbolse',
              attributes: ['id', 'uuid', 'codigo', 'numeroSemana', 'anio', 'fechaInicio', 'color'],
            },
          ],
        };
      }
      return inc;
    });

    return Evaluacion.findAll({
      where: semanaId ? { semanaId } : undefined,
      include: includes,
      order: [[{ model: Semana, as: 'semana' }, 'fechaInicio', 'ASC']],
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
