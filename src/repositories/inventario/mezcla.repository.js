import { Op } from 'sequelize';
import { Mezcla, MezclaVersion, MezclaComponente, Articulo, UnidadMedida, User } from '../../database/associations.js';

const LIST_INCLUDE = [
  { model: Articulo, as: 'articuloElaborado', attributes: ['uuid', 'nombre', 'codigo'] },
  { model: UnidadMedida, as: 'unidadRendimiento', attributes: ['uuid', 'nombre', 'simbolo'] },
];

const DETAIL_INCLUDE = [
  { model: Articulo, as: 'articuloElaborado', attributes: ['uuid', 'nombre', 'codigo', 'costoCompra', 'precioVenta'] },
  { model: UnidadMedida, as: 'unidadRendimiento', attributes: ['uuid', 'nombre', 'simbolo', 'codigo'] },
  { model: User, as: 'creadoPor', attributes: ['uuid', 'usuario'] },
  { model: User, as: 'actualizadoPor', attributes: ['uuid', 'usuario'] },
  {
    model: MezclaVersion,
    as: 'versiones',
    separate: false,
    order: [['version', 'DESC']],
    include: [
      {
        model: MezclaComponente,
        as: 'componentes',
        include: [
          { model: Articulo, as: 'articulo', attributes: ['uuid', 'nombre', 'codigo', 'costoCompra'] },
          { model: UnidadMedida, as: 'unidad', attributes: ['uuid', 'nombre', 'simbolo', 'codigo'] },
        ],
      },
    ],
  },
];

export const mezclaRepository = {
  async findAndCountAll({ limit, offset, search, estado, articuloElaboradoUuid }) {
    const where = {
      ...(search
        ? {
            [Op.or]: [
              { nombre: { [Op.like]: `%${search}%` } },
              { codigo: { [Op.like]: `%${search}%` } },
            ],
          }
        : {}),
      ...(estado !== undefined ? { estado } : {}),
    };

    if (articuloElaboradoUuid) {
      const prod = await Articulo.findOne({ where: { uuid: articuloElaboradoUuid } });
      where.articuloElaboradoId = prod ? prod.id : -1;
    }

    return Mezcla.findAndCountAll({
      where,
      limit,
      offset,
      order: [['nombre', 'ASC']],
      include: LIST_INCLUDE,
      distinct: true,
    });
  },

  findByUuid(uuid) {
    return Mezcla.findOne({ where: { uuid }, include: DETAIL_INCLUDE });
  },

  findByNombre(nombre) {
    return Mezcla.findOne({ where: { nombre } });
  },

  findByCodigo(codigo) {
    if (!codigo) return null;
    return Mezcla.findOne({ where: { codigo } });
  },

  create(data, { transaction } = {}) {
    return Mezcla.create(data, { transaction });
  },

  async update(mezcla, data, { transaction } = {}) {
    await mezcla.update(data, { transaction });
    return mezcla;
  },

  async softDelete(mezcla, deletedBy, { transaction } = {}) {
    await mezcla.update({ deletedBy }, { transaction });
    await mezcla.destroy({ transaction });
    return mezcla;
  },

  // Helpers para versiones
  findVersionByUuid(uuid) {
    return MezclaVersion.findOne({
      where: { uuid },
      include: [
        { model: Mezcla, as: 'mezcla', include: LIST_INCLUDE },
        { model: MezclaComponente, as: 'componentes', include: [{ model: Articulo, as: 'articulo' }, { model: UnidadMedida, as: 'unidad' }] },
      ],
    });
  },

  findActiveVersion(mezclaId, { transaction } = {}) {
    return MezclaVersion.findOne({ where: { mezclaId, activa: true }, order: [['version', 'DESC']], transaction });
  },
};

export default mezclaRepository;
