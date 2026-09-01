import { Op, fn, col } from 'sequelize';
import { Articulo, Almacen, Existencia, Equipo, ProgramacionMantenimiento, PlanMantenimiento, Proforma } from '../../database/associations.js';
import { sequelize } from '../../database/connection.js';

export const dashboardService = {
  async getResumen() {
    const [totalArticulos, totalAlmacenes, totalEquipos, totalProformas] = await Promise.all([
      Articulo.count(),
      Almacen.count({ where: { estado: true } }),
      Equipo.count(),
      Proforma.count(),
    ]);

    // Valor inventario: SUM(saldo * costoCompra) por artículo, agrupando el
    // saldo across almacenes. Lee del cache `existencias` (ver
    // stock.helper.js) en vez de recalcular sumando todo el histórico de
    // movimientos_inventario — mismo motivo que movimiento.repository.js#getExistencias.
    const saldos = await Existencia.findAll({
      attributes: ['articuloId', [fn('SUM', col('saldo')), 'saldo']],
      group: ['articuloId'],
      raw: true,
    });

    const articuloIds = saldos.map((s) => s.articuloId);
    const articulos = articuloIds.length ? await Articulo.findAll({ where: { id: articuloIds }, attributes: ['id', 'costoCompra', 'stockMinimo'] }) : [];
    const artMap = new Map(articulos.map((a) => [a.id, a]));

    let valorInventario = 0;
    let bajoStock = 0;
    for (const s of saldos) {
      const art = artMap.get(s.articuloId);
      const saldo = Number(s.saldo || 0);
      const costo = Number(art?.costoCompra || 0);
      valorInventario += saldo * costo;
      const stockMin = Number(art?.stockMinimo || 0);
      if (stockMin > 0 && saldo > 0 && saldo <= stockMin) bajoStock += 1;
      if (stockMin > 0 && saldo === 0) bajoStock += 1;
    }

    // Alternativa: incluir artículos sin movimientos pero con stockMinimo definido como bajo stock? Opcional, contamos solo con movimientos.
    // También contar artículos que manejan inventario pero sin saldo y con stockMinimo >0
    if (articulos.length) {
      // No duplicar ya contados: bajoStock ya incluye saldos 0 con movimiento 0? Pero saldos no incluye artículos sin movimientos (saldo 0 no aparece). Añadir esos.
      const idsConMovimiento = new Set(saldos.map((s) => s.articuloId));
      const sinMovimiento = articulos.filter((a) => !idsConMovimiento.has(a.id) && Number(a.stockMinimo || 0) > 0);
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
      articulos: totalArticulos,
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
