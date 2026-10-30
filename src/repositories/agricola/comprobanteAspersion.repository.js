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
  Pista,
  Colaborador,
  ComprobanteAspersionParticipante,
} from '../../database/associations.js';

const USUARIO_ATTRS = ['uuid', 'usuario', 'nombre', 'apellido', 'cargo'];

const aspersionInclude = (aspersionWhere, { conInsumos = false } = {}) => ({
  model: AspersionProgramacion,
  as: 'aspersion',
  required: true,
  where: aspersionWhere,
  include: [
    { model: Finca, as: 'finca', attributes: ['uuid', 'nombre', 'codigo', ...(conInsumos ? ['perimetro'] : [])] },
    { model: Semana, as: 'semana', attributes: ['uuid', 'codigo', 'numeroSemana', 'anio'] },
    { model: Almacen, as: 'almacen', attributes: ['uuid', 'nombre', 'codigo'] },
    {
      model: Mezcla,
      as: 'mezcla',
      // Una mezcla eliminada (soft delete) debe seguir viéndose en aspersiones/comprobantes ya registrados.
      paranoid: false,
      attributes: ['id', 'uuid', 'nombre', 'codigo', 'dosisPorHectarea'],
      include: [
        { model: UnidadMedida, as: 'unidadRendimiento', attributes: ['uuid', 'nombre', 'simbolo'] },
        { model: UnidadMedida, as: 'dosisPorHectareaUnidad', attributes: ['uuid', 'nombre', 'simbolo'] },
      ],
    },
    { model: User, as: 'usuario', attributes: USUARIO_ATTRS },
    // Solo en el detalle: los insumos con sus cantidades definitivas (`cantidad` = lo que se descontó al ejecutar;
    // `cantidadCalculada` = lo de la receta) y la pista. En el listado se omiten para evitar el subquery de un hasMany con limit.
    ...(conInsumos
      ? [
          {
            model: AspersionProgramacionComponente,
            as: 'componentes',
            include: [
              { model: Articulo, as: 'articulo', attributes: ['id', 'uuid', 'nombre', 'codigo'] },
              { model: UnidadMedida, as: 'unidad', attributes: ['uuid', 'nombre', 'simbolo'] },
            ],
          },
          { model: Pista, as: 'pista', attributes: ['uuid', 'nombre'], paranoid: false },
        ]
      : []),
  ],
});

const COLABORADOR_ATTRS = ['id', 'uuid', 'nombre', 'apellido', 'cargo', 'documento'];
const USUARIOS_INCLUDE = [
  { model: User, as: 'ejecutadoPor', attributes: USUARIO_ATTRS },
  { model: User, as: 'emitidoPor', attributes: USUARIO_ATTRS },
  { model: User, as: 'anuladoPor', attributes: USUARIO_ATTRS },
  { model: Colaborador, as: 'pilotoColaborador', attributes: COLABORADOR_ATTRS, paranoid: false },
];
// Solo en el detalle (un hasMany con limit en el listado obligaría a un subquery).
const PARTICIPANTES_INCLUDE = {
  model: ComprobanteAspersionParticipante,
  as: 'participantes',
  include: [{ model: Colaborador, as: 'colaborador', attributes: COLABORADOR_ATTRS, paranoid: false }],
};

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
      attributes: { exclude: ['kml', 'kmlGeometria'] },
      include: [aspersionInclude(aspersionWhere), ...USUARIOS_INCLUDE],
      distinct: true,
    });
  },

  findByUuid(uuid, { transaction } = {}) {
    return ComprobanteAspersion.findOne({
      where: { uuid },
      attributes: { exclude: ['kml'] },
      include: [aspersionInclude(undefined, { conInsumos: true }), ...USUARIOS_INCLUDE, PARTICIPANTES_INCLUDE],
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

  // Comprobante vigente de una aspersión (BORRADOR o EMITIDO). Los anulados no
  // cuentan: desde uno anulado se puede regenerar un borrador nuevo.
  activeForAspersion(aspersionProgramacionId, { transaction } = {}) {
    return ComprobanteAspersion.findOne({
      where: { aspersionProgramacionId, estado: { [Op.ne]: 'ANULADO' } },
      transaction,
    });
  },

  // Ids de aspersión (de una página del listado) que ya tienen comprobante
  // vigente. Permite calcular `puedeRegenerar` de todos los anulados de la
  // página con una sola consulta.
  async findActiveAspersionIds(aspersionProgramacionIds, { transaction } = {}) {
    const ids = [...new Set(aspersionProgramacionIds.filter(Boolean))];
    if (!ids.length) return new Set();
    const filas = await ComprobanteAspersion.findAll({
      where: { aspersionProgramacionId: { [Op.in]: ids }, estado: { [Op.ne]: 'ANULADO' } },
      attributes: ['aspersionProgramacionId'],
      raw: true,
      transaction,
    });
    return new Set(filas.map((f) => f.aspersionProgramacionId));
  },
};

export default comprobanteAspersionRepository;
