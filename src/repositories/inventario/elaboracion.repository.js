import { Op } from 'sequelize';
import { Elaboracion, MezclaVersion, Mezcla, MezclaComponente, Producto, UnidadMedida, Almacen, User } from '../../database/associations.js';

const INCLUDE = [
  {
    model: MezclaVersion,
    as: 'version',
    include: [
      {
        model: Mezcla,
        as: 'mezcla',
        attributes: ['uuid', 'nombre', 'codigo', 'rendimiento'],
        include: [
          { model: Producto, as: 'productoElaborado', attributes: ['uuid', 'nombre', 'codigo'] },
          { model: UnidadMedida, as: 'unidadRendimiento', attributes: ['uuid', 'nombre', 'simbolo'] },
        ],
      },
      {
        model: MezclaComponente,
        as: 'componentes',
        include: [
          { model: Producto, as: 'producto', attributes: ['uuid', 'nombre', 'codigo'] },
          { model: UnidadMedida, as: 'unidad', attributes: ['uuid', 'nombre', 'simbolo'] },
        ],
      },
    ],
  },
  { model: Almacen, as: 'almacen', attributes: ['uuid', 'nombre', 'codigo'] },
  { model: User, as: 'usuario', attributes: ['uuid', 'usuario', 'nombre'] },
];

export const elaboracionRepository = {
  async findAndCountAll({ limit, offset, mezclaUuid, mezclaVersionUuid, almacenUuid, fechaDesde, fechaHasta }) {
    const where = {};

    if (fechaDesde || fechaHasta) {
      where.fecha = {};
      if (fechaDesde) where.fecha[Op.gte] = fechaDesde;
      if (fechaHasta) where.fecha[Op.lte] = fechaHasta;
    }

    if (almacenUuid) {
      const alm = await Almacen.findOne({ where: { uuid: almacenUuid } });
      where.almacenId = alm ? alm.id : -1;
    }

    if (mezclaVersionUuid) {
      const ver = await MezclaVersion.findOne({ where: { uuid: mezclaVersionUuid } });
      where.mezclaVersionId = ver ? ver.id : -1;
    } else if (mezclaUuid) {
      const mezcla = await Mezcla.findOne({ where: { uuid: mezclaUuid } });
      if (mezcla) {
        const versiones = await MezclaVersion.findAll({ where: { mezclaId: mezcla.id }, attributes: ['id'] });
        const ids = versiones.map((v) => v.id);
        where.mezclaVersionId = ids.length ? { [Op.in]: ids } : -1;
      } else {
        where.mezclaVersionId = -1;
      }
    }

    return Elaboracion.findAndCountAll({
      where,
      limit,
      offset,
      order: [['fecha', 'DESC'], ['id', 'DESC']],
      include: INCLUDE,
      distinct: true,
    });
  },

  findByUuid(uuid) {
    return Elaboracion.findOne({ where: { uuid }, include: INCLUDE });
  },

  create(data, { transaction } = {}) {
    return Elaboracion.create(data, { transaction });
  },

  async update(elaboracion, data, { transaction } = {}) {
    await elaboracion.update(data, { transaction });
    return elaboracion;
  },

  async softDelete(elaboracion, { transaction } = {}) {
    // Elaboraciones son inmutables y no tienen softDelete real; se elimina físico si se requiere
    await elaboracion.destroy({ transaction });
    return elaboracion;
  },
};

export default elaboracionRepository;
