import { Op } from 'sequelize';
import { Factura, FacturaDetalle, Articulo, Proforma, User } from '../../database/associations.js';

const INCLUDE = [
  { model: FacturaDetalle, as: 'detalles', include: [{ model: Articulo, as: 'articulo', attributes: ['uuid', 'nombre', 'codigo'] }] },
  { model: Proforma, as: 'proforma', attributes: ['uuid', 'numero'] },
  { model: User, as: 'usuario', attributes: ['uuid', 'usuario', 'nombre'] },
];

export const facturaRepository = {
  async findAndCountAll({ limit, offset, search, estado, fechaDesde, fechaHasta }) {
    const where = {};
    if (search) {
      where[Op.or] = [{ cliente: { [Op.like]: `%${search}%` } }, { numero: { [Op.like]: `%${search}%` } }];
    }
    if (estado) where.estado = estado;
    if (fechaDesde || fechaHasta) {
      where.fecha = {};
      if (fechaDesde) where.fecha[Op.gte] = fechaDesde;
      if (fechaHasta) where.fecha[Op.lte] = fechaHasta;
    }
    return Factura.findAndCountAll({
      where,
      limit,
      offset,
      order: [['fecha', 'DESC'], ['id', 'DESC']],
      include: INCLUDE,
      distinct: true,
    });
  },

  findByUuid(uuid) {
    return Factura.findOne({ where: { uuid }, include: INCLUDE });
  },

  findByProformaId(proformaId) {
    return Factura.findOne({ where: { proformaId } });
  },

  create(data, { transaction } = {}) {
    return Factura.create(data, { transaction });
  },

  bulkCreateDetalles(detalles, { transaction } = {}) {
    return FacturaDetalle.bulkCreate(detalles, { transaction });
  },
};

export default facturaRepository;
