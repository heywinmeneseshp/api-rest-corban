import { Op } from 'sequelize';
import { Elaboracion, MezclaVersion, Mezcla, MezclaComponente, Articulo, UnidadMedida, Almacen, User } from '../../database/associations.js';

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
          {
            model: Articulo,
            as: 'articuloElaborado',
            attributes: ['uuid', 'nombre', 'codigo'],
            // La unidad real del producto elaborado es la que se eligió al
            // crearlo (articuloUnidadMedidaUuid en mezcla.service.js#crearElaborado)
            // — mezcla.unidadRendimiento es un campo legado que el flujo
            // actual nunca asigna, así que mostrarlo dejaba la cantidad sin
            // unidad en el detalle/listado de Elaboraciones.
            include: [{ model: UnidadMedida, as: 'unidadMedida', attributes: ['uuid', 'nombre', 'simbolo'] }],
          },
          { model: UnidadMedida, as: 'unidadRendimiento', attributes: ['uuid', 'nombre', 'simbolo'] },
        ],
      },
      {
        model: MezclaComponente,
        as: 'componentes',
        include: [
          { model: Articulo, as: 'articulo', attributes: ['uuid', 'nombre', 'codigo'] },
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

  // `transaction` es necesario cuando se llama justo después de crear
  // dentro de la misma transacción (elaboracion.service.js#create) — sin
  // pasarla, esta consulta corre en otra conexión y, según el nivel de
  // aislamiento, puede no ver todavía la fila recién escrita (devuelve
  // null antes de que la transacción externa haga commit).
  findByUuid(uuid, { transaction } = {}) {
    return Elaboracion.findOne({ where: { uuid }, include: INCLUDE, transaction });
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
