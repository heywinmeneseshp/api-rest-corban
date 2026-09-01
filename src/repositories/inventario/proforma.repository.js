import { Op } from 'sequelize';
import { Proforma, ProformaDetalle, Producto, User } from '../../database/associations.js';

const LIST_INCLUDE = [
  { model: ProformaDetalle, as: 'detalles', include: [{ model: Producto, as: 'producto', attributes: ['uuid', 'nombre', 'codigo'] }] },
  { model: User, as: 'usuario', attributes: ['uuid', 'usuario', 'nombre'] },
];

const DETAIL_INCLUDE = [
  {
    model: ProformaDetalle,
    as: 'detalles',
    include: [{ model: Producto, as: 'producto', attributes: ['uuid', 'nombre', 'codigo', 'precioVenta', 'costoCompra'] }],
  },
  { model: User, as: 'usuario', attributes: ['uuid', 'usuario', 'nombre'] },
  { model: User, as: 'creadoPor', attributes: ['uuid', 'usuario'] },
  { model: User, as: 'actualizadoPor', attributes: ['uuid', 'usuario'] },
];

export const proformaRepository = {
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
    return Proforma.findAndCountAll({
      where,
      limit,
      offset,
      order: [['fecha', 'DESC'], ['id', 'DESC']],
      include: LIST_INCLUDE,
      distinct: true,
    });
  },

  findByUuid(uuid) {
    return Proforma.findOne({ where: { uuid }, include: DETAIL_INCLUDE });
  },

  findByNumero(numero) {
    return Proforma.findOne({ where: { numero } });
  },

  create(data, { transaction } = {}) {
    return Proforma.create(data, { transaction });
  },

  async update(proforma, data, { transaction } = {}) {
    await proforma.update(data, { transaction });
    return proforma;
  },

  async softDelete(proforma, deletedBy, { transaction } = {}) {
    await proforma.update({ deletedBy }, { transaction });
    await proforma.destroy({ transaction });
    return proforma;
  },

  // detalles helpers
  async bulkCreateDetalles(detalles, { transaction } = {}) {
    return ProformaDetalle.bulkCreate(detalles, { transaction });
  },

  async deleteDetalles(proformaId, { transaction } = {}) {
    return ProformaDetalle.destroy({ where: { proformaId }, transaction });
  },
};

export default proformaRepository;
