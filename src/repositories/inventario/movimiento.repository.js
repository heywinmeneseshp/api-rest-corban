import { Op } from 'sequelize';
import { MovimientoInventario, Existencia, Almacen, Producto, UnidadMedida, Motivo, User } from '../../database/associations.js';

const INCLUDE = [
  { model: Almacen, as: 'almacen', attributes: ['uuid', 'nombre'] },
  { model: Producto, as: 'producto', attributes: ['uuid', 'nombre', 'codigo'] },
  { model: UnidadMedida, as: 'unidad', attributes: ['uuid', 'nombre', 'simbolo'] },
  { model: Motivo, as: 'motivo', attributes: ['uuid', 'nombre'] },
  { model: User, as: 'usuario', attributes: ['uuid', 'usuario'] },
];

export const movimientoRepository = {
  async findAndCountAll({ limit, offset, almacenUuid, productoUuid, tipo, fechaDesde, fechaHasta, documento }) {
    const where = {};
    if (tipo) where.tipo = tipo;
    if (documento) where.documento = { [Op.like]: `%${documento}%` };
    if (fechaDesde || fechaHasta) {
      where.fecha = {};
      if (fechaDesde) where.fecha[Op.gte] = fechaDesde;
      if (fechaHasta) where.fecha[Op.lte] = fechaHasta;
    }
    if (almacenUuid) {
      const alm = await Almacen.findOne({ where: { uuid: almacenUuid } });
      where.almacenId = alm ? alm.id : -1;
    }
    if (productoUuid) {
      const prod = await Producto.findOne({ where: { uuid: productoUuid } });
      where.productoId = prod ? prod.id : -1;
    }
    return MovimientoInventario.findAndCountAll({ where, limit, offset, order: [['fecha', 'DESC'], ['id', 'DESC']], include: INCLUDE });
  },

  findByUuid(uuid) {
    return MovimientoInventario.findOne({ where: { uuid }, include: INCLUDE });
  },

  create(data, { transaction } = {}) {
    return MovimientoInventario.create(data, { transaction });
  },

  // Lee del cache `existencias` (ver stock.helper.js) en vez de sumar todo
  // el histórico de movimientos_inventario en cada consulta — antes esto
  // era un GROUP BY + SUM() sobre la tabla completa, que crece con el total
  // histórico de movimientos y no con el stock actual.
  async getExistencias({ almacenUuid, productoUuid }) {
    const where = {};
    if (almacenUuid) {
      const alm = await Almacen.findOne({ where: { uuid: almacenUuid } });
      where.almacenId = alm ? alm.id : -1;
    }
    if (productoUuid) {
      const prod = await Producto.findOne({ where: { uuid: productoUuid } });
      where.productoId = prod ? prod.id : -1;
    }

    const filas = await Existencia.findAll({
      where,
      include: [
        { model: Almacen, as: 'almacen', attributes: ['uuid', 'nombre'] },
        { model: Producto, as: 'producto', attributes: ['uuid', 'nombre', 'codigo'] },
      ],
    });

    return filas.map((f) => ({
      almacen: f.almacen,
      producto: f.producto,
      saldo: Number(f.saldo),
    }));
  },

  // Kardex: todos los movimientos de un producto (y opcional almacen) ordenados por fecha
  async getKardex({ productoUuid, almacenUuid, fechaDesde, fechaHasta }) {
    const where = {};
    const prod = await Producto.findOne({ where: { uuid: productoUuid } });
    if (!prod) return [];
    where.productoId = prod.id;

    if (almacenUuid) {
      const alm = await Almacen.findOne({ where: { uuid: almacenUuid } });
      where.almacenId = alm ? alm.id : -1;
    }
    if (fechaDesde || fechaHasta) {
      where.fecha = {};
      if (fechaDesde) where.fecha[Op.gte] = fechaDesde;
      if (fechaHasta) where.fecha[Op.lte] = fechaHasta;
    }

    const movimientos = await MovimientoInventario.findAll({
      where,
      order: [['fecha', 'ASC'], ['id', 'ASC']],
      include: INCLUDE,
    });

    // Calcula saldo acumulado
    let saldo = 0;
    const tiposSuma = ['ENTRADA', 'AJUSTE_ENTRADA', 'TRANSFERENCIA_ENTRADA', 'ELABORACION_ENTRADA'];
    return movimientos.map((m) => {
      const esEntrada = tiposSuma.includes(m.tipo);
      saldo += esEntrada ? Number(m.cantidadBase) : -Number(m.cantidadBase);
      return {
        fecha: m.fecha,
        documento: m.documento,
        tipo: m.tipo,
        entrada: esEntrada ? Number(m.cantidadBase) : 0,
        salida: esEntrada ? 0 : Number(m.cantidadBase),
        saldo,
        costoUnitario: Number(m.costoUnitario),
        costoTotal: Number(m.costoTotal),
        almacen: m.almacen,
        lote: m.lote,
        motivo: m.motivo,
        usuario: m.usuario,
      };
    });
  },
};

export default movimientoRepository;
