import { Op, fn, col } from 'sequelize';
import { Producto, Almacen, Existencia, Equipo, ProgramacionMantenimiento, PlanMantenimiento, Proforma } from '../../database/associations.js';
import { sequelize } from '../../database/connection.js';

export const dashboardService = {
  async getResumen() {
    const [totalProductos, totalAlmacenes, totalEquipos, totalProformas] = await Promise.all([
      Producto.count(),
      Almacen.count({ where: { estado: true } }),
      Equipo.count(),
      Proforma.count(),
    ]);

    // Valor inventario: SUM(saldo * costoCompra) por producto, agrupando el
    // saldo across almacenes. Lee del cache `existencias` (ver
    // stock.helper.js) en vez de recalcular sumando todo el histórico de
    // movimientos_inventario — mismo motivo que movimiento.repository.js#getExistencias.
    const saldos = await Existencia.findAll({
      attributes: ['productoId', [fn('SUM', col('saldo')), 'saldo']],
      group: ['productoId'],
      raw: true,
    });

    const productoIds = saldos.map((s) => s.productoId);
    const productos = productoIds.length ? await Producto.findAll({ where: { id: productoIds }, attributes: ['id', 'costoCompra', 'stockMinimo'] }) : [];
    const prodMap = new Map(productos.map((p) => [p.id, p]));

    let valorInventario = 0;
    let bajoStock = 0;
    for (const s of saldos) {
      const prod = prodMap.get(s.productoId);
      const saldo = Number(s.saldo || 0);
      const costo = Number(prod?.costoCompra || 0);
      valorInventario += saldo * costo;
      const stockMin = Number(prod?.stockMinimo || 0);
      if (stockMin > 0 && saldo > 0 && saldo <= stockMin) bajoStock += 1;
      if (stockMin > 0 && saldo === 0) bajoStock += 1;
    }

    // Alternativa: incluir productos sin movimientos pero con stockMinimo definido como bajo stock? Opcional, contamos solo con movimientos.
    // También contar productos que manejan inventario pero sin saldo y con stockMinimo >0
    if (productos.length) {
      // No duplicar ya contados: bajoStock ya incluye saldos 0 con movimiento 0? Pero saldos no incluye productos sin movimientos (saldo 0 no aparece). Añadir esos.
      const idsConMovimiento = new Set(saldos.map((s) => s.productoId));
      const sinMovimiento = productos.filter((p) => !idsConMovimiento.has(p.id) && Number(p.stockMinimo || 0) > 0);
      bajoStock += sinMovimiento.length;
    }

    // Próximos mantenimientos: programaciones pendientes/programadas ordenadas por fecha
    const hoy = new Date().toISOString().slice(0, 10);
    const proximosMantenimientos = await ProgramacionMantenimiento.findAll({
      where: { estado: { [Op.in]: ['PENDIENTE', 'PROGRAMADA'] }, fechaProgramada: { [Op.gte]: hoy } },
      order: [['fechaProgramada', 'ASC']],
      limit: 5,
      include: [{ model: Equipo, as: 'equipo', attributes: ['uuid', 'codigo', 'nombre'] }, { model: PlanMantenimiento, as: 'plan', attributes: ['uuid', 'nombre'] }],
    });

    const equiposFueraServicio = await Equipo.count({ where: { estado: 'FUERA_SERVICIO' } });
    const equiposMantenimiento = await Equipo.count({ where: { estado: 'MANTENIMIENTO' } });

    // Conteos extras para dashboard
    const proformasPendientes = await Proforma.count({ where: { estado: 'BORRADOR' } });
    const proformasAprobadas = await Proforma.count({ where: { estado: 'APROBADA' } });

    const ordenesAbiertas = await sequelize.query("SELECT COUNT(*) as cnt FROM ordenes_mantenimiento WHERE estado IN ('ABIERTA','EN_PROCESO')", { type: sequelize.QueryTypes.SELECT }).then(r => Number(r[0]?.cnt || 0)).catch(() => 0);

    return {
      productos: totalProductos,
      almacenes: totalAlmacenes,
      equipos: totalEquipos,
      proformas: totalProformas,
      valorInventario: Number(valorInventario.toFixed(2)),
      bajoStock,
      proximosMantenimientos: proximosMantenimientos.map((p) => ({
        uuid: p.uuid,
        fechaProgramada: p.fechaProgramada,
        estado: p.estado,
        prioridad: p.prioridad,
        equipo: p.equipo,
        plan: p.plan,
      })),
      equiposFueraServicio,
      equiposEnMantenimiento: equiposMantenimiento,
      proformasPendientes,
      proformasAprobadas,
      ordenesAbiertas,
    };
  },
};

export default dashboardService;
