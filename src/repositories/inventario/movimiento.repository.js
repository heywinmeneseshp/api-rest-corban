import { Op, fn, col, literal } from 'sequelize';
import { MovimientoInventario, Almacen, Producto, UnidadMedida, Motivo, User } from '../../database/associations.js';

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

  // Para existencias: suma por almacen+producto
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

    // Tipos que suman y restan
    const tiposSuma = ['ENTRADA', 'AJUSTE_ENTRADA', 'TRANSFERENCIA_ENTRADA', 'ELABORACION_ENTRADA'];
    const tiposResta = ['SALIDA', 'AJUSTE_SALIDA', 'TRANSFERENCIA_SALIDA', 'ELABORACION_SALIDA'];

    const movimientos = await MovimientoInventario.findAll({
      where,
      attributes: ['almacenId', 'productoId', [fn('SUM', literal(`CASE WHEN tipo IN ('${tiposSuma.join("','")}') THEN cantidad_base ELSE -cantidad_base END`)), 'saldo']],
      group: ['almacenId', 'productoId'],
      raw: true,
    });

    // Hidrata nombres
    const almacenIds = [...new Set(movimientos.map((m) => m.almacenId))];
    const productoIds = [...new Set(movimientos.map((m) => m.productoId))];
    const almacenes = await Almacen.findAll({ where: { id: almacenIds }, attributes: ['id', 'uuid', 'nombre'] });
    const productos = await Producto.findAll({ where: { id: productoIds }, attributes: ['id', 'uuid', 'nombre', 'codigo'] });
    const almMap = new Map(almacenes.map((a) => [a.id, a]));
    const prodMap = new Map(productos.map((p) => [p.id, p]));

    return movimientos.map((m) => ({
      almacen: almMap.get(m.almacenId),
      producto: prodMap.get(m.productoId),
      saldo: Number(m.saldo),
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
