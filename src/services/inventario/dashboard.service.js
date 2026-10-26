import { Op } from 'sequelize';
import { Articulo, Almacen, Equipo, ProgramacionMantenimiento, PlanMantenimiento, Proforma } from '../../database/associations.js';
import { sequelize } from '../../database/connection.js';

export const dashboardService = {
  async getResumen() {
    const [totalArticulos, totalAlmacenes, totalEquipos, totalProformas] = await Promise.all([
      Articulo.count(),
      Almacen.count({ where: { estado: true } }),
      Equipo.count(),
      Proforma.count(),
    ]);

    // Valor del inventario y bajo stock desde el cache `existencias` (ver stock.helper.js), con todos los artículos activos que manejan
    // inventario — también los que nunca tuvieron movimientos (saldo 0), que antes no se contaban como bajo stock.
    const porArticulo = await sequelize.query(
      `SELECT a.uuid, a.codigo, a.nombre, a.costo_compra AS costo, a.stock_minimo AS minimo, u.simbolo AS unidad,
              COALESCE(SUM(e.saldo), 0) AS saldo
         FROM articulos a
         LEFT JOIN existencias e ON e.articulo_id = a.id
         LEFT JOIN unidades_medida u ON u.id = a.unidad_medida_id
        WHERE a.deleted_at IS NULL AND a.estado = 1 AND a.maneja_inventario = 1
        GROUP BY a.id, a.uuid, a.codigo, a.nombre, a.costo_compra, a.stock_minimo, u.simbolo`,
      { type: sequelize.QueryTypes.SELECT },
    );
    let valorInventario = 0;
    let articulosConSaldo = 0;
    const bajoStockLista = [];
    for (const r of porArticulo) {
      const saldo = Number(r.saldo || 0);
      const minimo = Number(r.minimo || 0);
      valorInventario += saldo * Number(r.costo || 0);
      if (saldo > 0) articulosConSaldo += 1;
      if (minimo > 0 && saldo <= minimo) {
        bajoStockLista.push({ uuid: r.uuid, codigo: r.codigo, nombre: r.nombre, unidad: r.unidad, saldo, stockMinimo: minimo });
      }
    }
    bajoStockLista.sort((x, y) => x.saldo / x.stockMinimo - y.saldo / y.stockMinimo);
    const bajoStock = bajoStockLista.length;

    // Últimos movimientos y totales de los últimos 30 días por tipo.
    const ultimosMovimientos = await sequelize.query(
      `SELECT m.uuid, m.documento, m.tipo, m.fecha, m.cantidad, a.uuid AS articuloUuid, a.nombre AS articulo, al.nombre AS almacen,
              u.simbolo AS unidad
         FROM movimientos_inventario m
         JOIN articulos a ON a.id = m.articulo_id
         JOIN almacenes al ON al.id = m.almacen_id
         LEFT JOIN unidades_medida u ON u.id = m.unidad_id
        ORDER BY m.fecha DESC, m.id DESC
        LIMIT 10`,
      { type: sequelize.QueryTypes.SELECT },
    );
    const movimientos30Dias = await sequelize.query(
      `SELECT tipo, COUNT(*) AS cantidad FROM movimientos_inventario
        WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) GROUP BY tipo`,
      { type: sequelize.QueryTypes.SELECT },
    );

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
      articulos: totalArticulos,
      almacenes: totalAlmacenes,
      equipos: totalEquipos,
      proformas: totalProformas,
      valorInventario: Number(valorInventario.toFixed(2)),
      bajoStock,
      bajoStockLista: bajoStockLista.slice(0, 15),
      articulosConSaldo,
      ultimosMovimientos: ultimosMovimientos.map((m) => ({ ...m, cantidad: Number(m.cantidad) })),
      movimientos30Dias: movimientos30Dias.map((m) => ({ tipo: m.tipo, cantidad: Number(m.cantidad) })),
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
