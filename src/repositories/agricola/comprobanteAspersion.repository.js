import { Op } from 'sequelize';
import {
  ComprobanteAspersion,
  AspersionProgramacion,
  AspersionProgramacionComponente,
  Finca,
  Semana,
  Mezcla,
  Articulo,
  UnidadMedida,
  Almacen,
  User,
} from '../../database/associations.js';

const USUARIO_ATTRS = ['uuid', 'usuario', 'nombre', 'apellido', 'cargo'];

const aspersionInclude = (aspersionWhere, { conInsumos = false } = {}) => ({
  model: AspersionProgramacion,
  as: 'aspersion',
  required: true,
  where: aspersionWhere,
  include: [
    { model: Finca, as: 'finca', attributes: ['uuid', 'nombre', 'codigo'] },
    { model: Semana, as: 'semana', attributes: ['uuid', 'codigo', 'numeroSemana', 'anio'] },
    { model: Almacen, as: 'almacen', attributes: ['uuid', 'nombre', 'codigo'] },
    {
      model: Mezcla,
      as: 'mezcla',
      attributes: ['id', 'uuid', 'nombre', 'codigo', 'dosisPorHectarea'],
      include: [
        { model: UnidadMedida, as: 'unidadRendimiento', attributes: ['uuid', 'nombre', 'simbolo'] },
        { model: UnidadMedida, as: 'dosisPorHectareaUnidad', attributes: ['uuid', 'nombre', 'simbolo'] },
      ],
    },
    { model: User, as: 'usuario', attributes: USUARIO_ATTRS },
    // Solo en el detalle: los insumos (NOMBRES — el comprobante no muestra
    // cantidades). En el listado se omiten para evitar el subquery de un
    // hasMany con limit.
    ...(conInsumos
      ? [
          {
            model: AspersionProgramacionComponente,
            as: 'componentes',
            include: [{ model: Articulo, as: 'articulo', attributes: ['id', 'uuid', 'nombre'] }],
          },
        ]
      : []),
  ],
});

const USUARIOS_INCLUDE = [
  { model: User, as: 'ejecutadoPor', attributes: USUARIO_ATTRS },
  { model: User, as: 'emitidoPor', attributes: USUARIO_ATTRS },
];

export const comprobanteAspersionRepository = {
  async findAndCountAll({ limit, offset, estado, fincaUuid, semanaUuid, search, fechaDesde, fechaHasta, almacenIdsPermitidos }) {
    const where = {};
    if (estado) where.estado = estado;
    if (fechaDesde || fechaHasta) {
      where.ejecutadoEn = {};
      if (fechaDesde) where.ejecutadoEn[Op.gte] = new Date(`${fechaDesde}T00:00:00`);
      if (fechaHasta) where.ejecutadoEn[Op.lte] = new Date(`${fechaHasta}T23:59:59`);
    }
    if (search) {
      const like = `%${search}%`;
      where[Op.or] = [
        { numero: { [Op.like]: like } },
        { piloto: { [Op.like]: like } },
        { '$aspersion.numero$': { [Op.like]: like } },
        { '$aspersion.mezcla.nombre$': { [Op.like]: like } },
        { '$aspersion.finca.nombre$': { [Op.like]: like } },
      ];
    }

    const aspersionWhere = {};
    if (almacenIdsPermitidos !== null && almacenIdsPermitidos !== undefined) {
      aspersionWhere.almacenId = { [Op.in]: almacenIdsPermitidos };
    }
    if (fincaUuid) {
      const finca = await Finca.findOne({ where: { uuid: fincaUuid } });
      aspersionWhere.fincaId = finca ? finca.id : -1;
    }
    if (semanaUuid) {
      const semana = await Semana.findOne({ where: { uuid: semanaUuid } });
      aspersionWhere.semanaId = semana ? semana.id : -1;
    }

    return ComprobanteAspersion.findAndCountAll({
      where,
      limit,
      offset,
      order: [['ejecutadoEn', 'DESC'], ['id', 'DESC']],
      include: [aspersionInclude(aspersionWhere), ...USUARIOS_INCLUDE],
      distinct: true,
    });
  },

  findByUuid(uuid, { transaction } = {}) {
    return ComprobanteAspersion.findOne({
      where: { uuid },
      include: [aspersionInclude(undefined, { conInsumos: true }), ...USUARIOS_INCLUDE],
      transaction,
    });
  },

  create(data, { transaction } = {}) {
    return ComprobanteAspersion.create(data, { transaction });
  },

  async update(comprobante, data, { transaction } = {}) {
    await comprobante.update(data, { transaction });
    return comprobante;
  },

  async softDelete(comprobante, deletedBy, { transaction } = {}) {
    await comprobante.update({ deletedBy }, { transaction });
    await comprobante.destroy({ transaction });
  },
};

export default comprobanteAspersionRepository;
