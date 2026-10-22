import { Op, fn, literal } from 'sequelize';
import { MovimientoInventario, Existencia, Almacen, Articulo, UnidadMedida, Motivo, Proveedor, User } from '../../database/associations.js';

const INCLUDE = [
  { model: Almacen, as: 'almacen', attributes: ['uuid', 'nombre'] },
  { model: Articulo, as: 'articulo', attributes: ['uuid', 'nombre', 'codigo'] },
  { model: UnidadMedida, as: 'unidad', attributes: ['uuid', 'nombre', 'simbolo'] },
  { model: Motivo, as: 'motivo', attributes: ['uuid', 'nombre'] },
  { model: Proveedor, as: 'proveedor', attributes: ['uuid', 'nombre'], required: false },
  { model: User, as: 'usuario', attributes: ['uuid', 'usuario'] },
];

export const movimientoRepository = {
  async findAndCountAll({ limit, offset, almacenUuid, articuloUuid, tipo, fechaDesde, fechaHasta, documento }) {
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
    if (articuloUuid) {
      const prod = await Articulo.findOne({ where: { uuid: articuloUuid } });
      where.articuloId = prod ? prod.id : -1;
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
  // Saldo en una fecha pasada: se reconstruye desde el kárdex (movimientos hasta ese día, inclusive). Coincide con el cache `existencias`
  // porque cada movimiento lo actualiza en la misma transacción. Devuelve todas las filas ya ordenadas (almacén y artículo).
  async getExistenciasAFecha({ almacenUuid, articuloUuid, fecha }) {
    const where = { fecha: { [Op.lte]: fecha } };
    if (almacenUuid) {
      const alm = await Almacen.findOne({ where: { uuid: almacenUuid } });
      where.almacenId = alm ? alm.id : -1;
    }
    if (articuloUuid) {
      const prod = await Articulo.findOne({ where: { uuid: articuloUuid } });
      where.articuloId = prod ? prod.id : -1;
    }
    const sumas = await MovimientoInventario.findAll({
      where,
      attributes: [
        'almacenId',
        'articuloId',
        [fn('SUM', literal("CASE WHEN tipo IN ('ENTRADA','AJUSTE_ENTRADA','TRANSFERENCIA_ENTRADA','ELABORACION_ENTRADA') THEN cantidad_base ELSE -cantidad_base END")), 'saldo'],
      ],
      group: ['almacenId', 'articuloId'],
      raw: true,
    });
    if (sumas.length === 0) return [];
    const [almacenes, articulos] = await Promise.all([
      Almacen.findAll({ where: { id: { [Op.in]: [...new Set(sumas.map((s) => s.almacenId))] } }, attributes: ['id', 'uuid', 'nombre'], paranoid: false }),
      Articulo.findAll({
        where: { id: { [Op.in]: [...new Set(sumas.map((s) => s.articuloId))] } },
        attributes: ['id', 'uuid', 'nombre', 'codigo'],
        include: [{ model: UnidadMedida, as: 'unidadMedida', attributes: ['uuid', 'nombre', 'simbolo'] }],
        paranoid: false,
      }),
    ]);
    const almPorId = new Map(almacenes.map((a) => [a.id, a]));
    const artPorId = new Map(articulos.map((a) => [a.id, a]));
    return sumas
      .map((s) => {
        const a = almPorId.get(s.almacenId);
        const p = artPorId.get(s.articuloId);
        return {
          almacen: a ? { uuid: a.uuid, nombre: a.nombre } : null,
          articulo: p ? { uuid: p.uuid, nombre: p.nombre, codigo: p.codigo } : null,
          unidad: p?.unidadMedida ? { uuid: p.unidadMedida.uuid, nombre: p.unidadMedida.nombre, simbolo: p.unidadMedida.simbolo } : null,
          saldo: Math.round(Number(s.saldo) * 100) / 100,
        };
      })
      .sort((x, y) => String(x.almacen?.nombre).localeCompare(String(y.almacen?.nombre)) || String(x.articulo?.nombre).localeCompare(String(y.articulo?.nombre)));
  },

  async getExistenciasPaginado({ almacenUuid, articuloUuid, limit, offset }) {
    const { where, include } = await this._existenciasQuery({ almacenUuid, articuloUuid });
    const { rows, count } = await Existencia.findAndCountAll({
      where,
      include,
      order: [[{ model: Almacen, as: 'almacen' }, 'nombre', 'ASC'], [{ model: Articulo, as: 'articulo' }, 'nombre', 'ASC']],
      limit,
      offset,
    });
    return { items: this._existenciasFilas(rows), total: count };
  },

  async _existenciasQuery({ almacenUuid, articuloUuid }) {
    const where = {};
    if (almacenUuid) {
      const alm = await Almacen.findOne({ where: { uuid: almacenUuid } });
      where.almacenId = alm ? alm.id : -1;
    }
    if (articuloUuid) {
      const prod = await Articulo.findOne({ where: { uuid: articuloUuid } });
      where.articuloId = prod ? prod.id : -1;
    }
    const include = [
      { model: Almacen, as: 'almacen', attributes: ['uuid', 'nombre'] },
      { model: Articulo, as: 'articulo', attributes: ['uuid', 'nombre', 'codigo'], include: [{ model: UnidadMedida, as: 'unidadMedida', attributes: ['uuid', 'nombre', 'simbolo'] }] },
    ];
    return { where, include };
  },

  _existenciasFilas(filas) {
    return filas.map((f) => ({
      almacen: f.almacen,
      articulo: f.articulo,
      unidad: f.articulo?.unidadMedida ? { uuid: f.articulo.unidadMedida.uuid, nombre: f.articulo.unidadMedida.nombre, simbolo: f.articulo.unidadMedida.simbolo } : null,
      saldo: Number(f.saldo),
    }));
  },

  async getExistencias({ almacenUuid, articuloUuid }) {
    const where = {};
    if (almacenUuid) {
      const alm = await Almacen.findOne({ where: { uuid: almacenUuid } });
      where.almacenId = alm ? alm.id : -1;
    }
    if (articuloUuid) {
      const prod = await Articulo.findOne({ where: { uuid: articuloUuid } });
      where.articuloId = prod ? prod.id : -1;
    }

    const filas = await Existencia.findAll({
      where,
      include: [
        { model: Almacen, as: 'almacen', attributes: ['uuid', 'nombre'] },
        // El saldo está expresado en la unidad de medida del artículo.
        { model: Articulo, as: 'articulo', attributes: ['uuid', 'nombre', 'codigo'], include: [{ model: UnidadMedida, as: 'unidadMedida', attributes: ['uuid', 'nombre', 'simbolo'] }] },
      ],
    });

    return filas.map((f) => ({
      almacen: f.almacen,
      articulo: f.articulo,
      unidad: f.articulo?.unidadMedida ? { uuid: f.articulo.unidadMedida.uuid, nombre: f.articulo.unidadMedida.nombre, simbolo: f.articulo.unidadMedida.simbolo } : null,
      saldo: Number(f.saldo),
    }));
  },

  // Kardex: todos los movimientos de un artículo (y opcional almacen) ordenados por fecha
  async getKardex({ articuloUuid, almacenUuid, fechaDesde, fechaHasta }) {
    const where = {};
    const prod = await Articulo.findOne({ where: { uuid: articuloUuid } });
    if (!prod) return [];
    where.articuloId = prod.id;

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
