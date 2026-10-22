import { Op } from 'sequelize';
import { sequelize } from '../../database/connection.js';
import {
  Almacen,
  Articulo,
  ArticuloAlmacen,
  ArticuloCategoria,
  ConteoInventario,
  ConteoInventarioDetalle,
  Existencia,
  Motivo,
  UnidadMedida,
} from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { assertAlmacenPermitido, getAlmacenIdsPermitidas } from '../../utils/almacenScope.js';
import { getExistencia } from './stock.helper.js';
import { movimientoService } from './movimiento.service.js';

// Conteo (toma de inventario físico) por almacén. Se crea en BORRADOR con los artículos del almacén y el saldo del sistema; se digita
// lo contado y al CERRAR cada diferencia contra el saldo vigente se registra como un ajuste (entrada o salida) en el kárdex, de modo que
// la existencia quede igual a lo contado. Los artículos ELABORADOS nunca tienen saldo propio y no entran.

const hoyColombia = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
const num = (v) => (v === null || v === undefined ? null : Number(v));
const redondear = (n) => Math.round(n * 100) / 100;
const EPS = 0.005;

const incluirArticulo = [
  { model: ArticuloCategoria, as: 'categoria', attributes: ['uuid', 'nombre', 'tipo'] },
  { model: UnidadMedida, as: 'unidadMedida', attributes: ['uuid', 'nombre', 'simbolo'] },
];

async function cargarConteo(uuid, user, opciones = {}) {
  const conteo = await ConteoInventario.findOne({
    where: { uuid },
    include: [
      { model: Almacen, as: 'almacen', attributes: ['id', 'uuid', 'nombre', 'codigo'] },
      { model: ArticuloCategoria, as: 'categoria', attributes: ['uuid', 'nombre'] },
      { model: Motivo, as: 'motivo', attributes: ['uuid', 'nombre'] },
    ],
    ...opciones,
  });
  if (!conteo) throw ApiError.notFound('Conteo no encontrado');
  assertAlmacenPermitido(user, conteo.almacenId);
  return conteo;
}

function resumenDe(detalles) {
  const contados = detalles.filter((d) => d.cantidadContada !== null && d.cantidadContada !== undefined);
  const conDiferencia = contados.filter((d) => Math.abs(Number(d.cantidadContada) - Number(d.saldoCierre ?? d.saldoSistema)) >= EPS);
  return { articulos: detalles.length, contados: contados.length, conDiferencia: conDiferencia.length };
}

export const conteoService = {
  async list(query, user) {
    const { page, limit, offset } = getPagination(query);
    const where = {};
    const permitidas = getAlmacenIdsPermitidas(user);
    if (query.almacenUuid) {
      const almacen = await Almacen.findOne({ where: { uuid: query.almacenUuid }, attributes: ['id'] });
      if (!almacen) throw ApiError.notFound('Almacén no encontrado');
      assertAlmacenPermitido(user, almacen.id);
      where.almacenId = almacen.id;
    } else if (permitidas) {
      where.almacenId = { [Op.in]: permitidas };
    }
    if (query.estado) where.estado = query.estado;

    const { rows, count } = await ConteoInventario.findAndCountAll({
      where,
      include: [{ model: Almacen, as: 'almacen', attributes: ['uuid', 'nombre', 'codigo'] }, { model: ArticuloCategoria, as: 'categoria', attributes: ['uuid', 'nombre'] }],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true,
    });
    const ids = rows.map((c) => c.id);
    const detalles = ids.length ? await ConteoInventarioDetalle.findAll({ where: { conteoId: { [Op.in]: ids } }, raw: true }) : [];
    const porConteo = new Map();
    for (const d of detalles) {
      if (!porConteo.has(d.conteoId)) porConteo.set(d.conteoId, []);
      porConteo.get(d.conteoId).push({ ...d, cantidadContada: d.cantidadContada === null ? null : Number(d.cantidadContada), saldoSistema: Number(d.saldoSistema), saldoCierre: num(d.saldoCierre) });
    }
    const items = rows.map((c) => ({
      uuid: c.uuid,
      numero: c.id,
      documento: `CNT-${String(c.id).padStart(5, '0')}`,
      fecha: c.fecha,
      estado: c.estado,
      ciego: c.ciego,
      almacen: c.almacen ? { uuid: c.almacen.uuid, nombre: c.almacen.nombre, codigo: c.almacen.codigo } : null,
      categoria: c.categoria ? { uuid: c.categoria.uuid, nombre: c.categoria.nombre } : null,
      observaciones: c.observaciones,
      cerradoAt: c.cerradoAt,
      ...resumenDe(porConteo.get(c.id) || []),
    }));
    return { items, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getByUuid(uuid, user) {
    const conteo = await cargarConteo(uuid, user);
    const detalles = await ConteoInventarioDetalle.findAll({
      where: { conteoId: conteo.id },
      include: [{ model: Articulo, as: 'articulo', attributes: ['id', 'uuid', 'codigo', 'nombre'], include: incluirArticulo }],
    });
    // Saldo vigente (en vivo) mientras el conteo está abierto, para ver si hubo movimientos desde que se creó.
    const existencias = conteo.estado === 'BORRADOR' ? await Existencia.findAll({ where: { almacenId: conteo.almacenId }, raw: true }) : [];
    const saldoVigente = new Map(existencias.map((e) => [e.articuloId, Number(e.saldo)]));
    const oculto = conteo.ciego && conteo.estado === 'BORRADOR'; // conteo ciego: no se muestra el saldo mientras se cuenta

    const lineas = detalles
      .map((d) => {
        const contada = num(d.cantidadContada);
        const referencia = d.saldoCierre !== null && d.saldoCierre !== undefined ? Number(d.saldoCierre) : saldoVigente.get(d.articuloId) ?? Number(d.saldoSistema);
        return {
          articuloUuid: d.articulo.uuid,
          codigo: d.articulo.codigo,
          nombre: d.articulo.nombre,
          categoria: d.articulo.categoria?.nombre || null,
          unidad: d.articulo.unidadMedida ? d.articulo.unidadMedida.simbolo || d.articulo.unidadMedida.nombre : null,
          saldoSistema: oculto ? null : Number(d.saldoSistema),
          saldoVigente: oculto ? null : redondear(referencia),
          cantidadContada: contada,
          diferencia: oculto || contada === null ? null : redondear(contada - referencia),
          observacion: d.observacion,
          ajustado: d.movimientoId !== null && d.movimientoId !== undefined,
        };
      })
      .sort((a, b) => String(a.categoria || '').localeCompare(String(b.categoria || '')) || a.nombre.localeCompare(b.nombre));

    return {
      uuid: conteo.uuid,
      numero: conteo.id,
      documento: `CNT-${String(conteo.id).padStart(5, '0')}`,
      fecha: conteo.fecha,
      estado: conteo.estado,
      ciego: conteo.ciego,
      almacen: { uuid: conteo.almacen.uuid, nombre: conteo.almacen.nombre, codigo: conteo.almacen.codigo },
      categoria: conteo.categoria ? { uuid: conteo.categoria.uuid, nombre: conteo.categoria.nombre } : null,
      motivo: conteo.motivo ? { uuid: conteo.motivo.uuid, nombre: conteo.motivo.nombre } : null,
      observaciones: conteo.observaciones,
      cerradoAt: conteo.cerradoAt,
      resumen: resumenDe(detalles),
      lineas,
    };
  },

  async create(payload, actorId, user) {
    const almacen = await Almacen.findOne({ where: { uuid: payload.almacenUuid } });
    if (!almacen) throw ApiError.notFound('Almacén no encontrado');
    assertAlmacenPermitido(user, almacen.id);

    let categoriaId = null;
    if (payload.categoriaUuid) {
      const categoria = await ArticuloCategoria.findOne({ where: { uuid: payload.categoriaUuid }, attributes: ['id'] });
      if (!categoria) throw ApiError.notFound('Categoría no encontrada');
      categoriaId = categoria.id;
    }

    // Un solo conteo abierto por almacén y categoría: evita dos personas contando lo mismo y ajustando dos veces.
    const abierto = await ConteoInventario.findOne({ where: { almacenId: almacen.id, categoriaId, estado: 'BORRADOR' }, attributes: ['id'] });
    if (abierto) {
      throw ApiError.badRequest(`Ya hay un conteo abierto (CNT-${String(abierto.id).padStart(5, '0')}) para ese almacén${categoriaId ? ' y categoría' : ''}. Ciérralo o anúlalo primero.`);
    }

    // Artículos del almacén: los que ya tienen existencia registrada o están asignados a él.
    const [existencias, asignados] = await Promise.all([
      Existencia.findAll({ where: { almacenId: almacen.id }, raw: true }),
      ArticuloAlmacen.findAll({ where: { almacenId: almacen.id }, attributes: ['articuloId'], raw: true }),
    ]);
    const saldoPorArticulo = new Map(existencias.map((e) => [e.articuloId, Number(e.saldo)]));
    const ids = [...new Set([...saldoPorArticulo.keys(), ...asignados.map((a) => a.articuloId)])];
    const articulos = ids.length
      ? await Articulo.findAll({
          where: { id: { [Op.in]: ids }, estado: true, manejaInventario: true, ...(categoriaId ? { categoriaId } : {}) },
          include: [{ model: ArticuloCategoria, as: 'categoria', attributes: ['tipo'] }],
        })
      : [];
    const contables = articulos.filter((a) => a.categoria?.tipo !== 'ELABORADO');
    if (contables.length === 0) throw ApiError.badRequest('No hay artículos con inventario en ese almacén para contar');

    return sequelize.transaction(async (t) => {
      const conteo = await ConteoInventario.create(
        {
          almacenId: almacen.id,
          categoriaId,
          fecha: hoyColombia(),
          estado: 'BORRADOR',
          ciego: Boolean(payload.ciego),
          observaciones: payload.observaciones || null,
          createdBy: actorId,
        },
        { transaction: t },
      );
      await ConteoInventarioDetalle.bulkCreate(
        contables.map((a) => ({ conteoId: conteo.id, articuloId: a.id, saldoSistema: saldoPorArticulo.get(a.id) ?? 0 })),
        { transaction: t },
      );
      return { uuid: conteo.uuid, numero: conteo.id, documento: `CNT-${String(conteo.id).padStart(5, '0')}`, articulos: contables.length };
    });
  },

  // Guarda lo digitado (se puede llamar varias veces mientras el conteo está en BORRADOR). cantidadContada null = no contado.
  async guardarLineas(uuid, lineas, actorId, user) {
    const conteo = await cargarConteo(uuid, user);
    if (conteo.estado !== 'BORRADOR') throw ApiError.badRequest('Solo se puede digitar un conteo en borrador');
    const articulos = await Articulo.findAll({ where: { uuid: { [Op.in]: lineas.map((l) => l.articuloUuid) } }, attributes: ['id', 'uuid'], raw: true });
    const idPorUuid = new Map(articulos.map((a) => [a.uuid, a.id]));
    await sequelize.transaction(async (t) => {
      for (const l of lineas) {
        const articuloId = idPorUuid.get(l.articuloUuid);
        if (!articuloId) continue;
        await ConteoInventarioDetalle.update(
          { cantidadContada: l.cantidadContada === undefined ? null : l.cantidadContada, observacion: l.observacion || null },
          { where: { conteoId: conteo.id, articuloId }, transaction: t },
        );
      }
      await conteo.update({ updatedBy: actorId }, { transaction: t });
    });
    return this.getByUuid(uuid, user);
  },

  // Cierra el conteo: por cada artículo contado, compara con el saldo VIGENTE (con bloqueo) y registra el ajuste en el kárdex.
  async cerrar(uuid, payload, actorId, user) {
    const conteo = await cargarConteo(uuid, user);
    if (conteo.estado !== 'BORRADOR') throw ApiError.badRequest('El conteo ya no está en borrador');
    const motivo = await Motivo.findOne({ where: { uuid: payload.motivoUuid } });
    if (!motivo) throw ApiError.notFound('Motivo no encontrado');
    const detalles = await ConteoInventarioDetalle.findAll({
      where: { conteoId: conteo.id, cantidadContada: { [Op.not]: null } },
      include: [{ model: Articulo, as: 'articulo', attributes: ['id', 'uuid', 'nombre'] }],
    });
    if (detalles.length === 0) throw ApiError.badRequest('Aún no has digitado ninguna cantidad contada');
    const documento = `CNT-${String(conteo.id).padStart(5, '0')}`;

    return sequelize.transaction(async (t) => {
      let ajustes = 0;
      for (const d of detalles) {
        const saldo = await getExistencia(conteo.almacenId, d.articuloId, { transaction: t, lock: true });
        const diferencia = redondear(Number(d.cantidadContada) - saldo);
        let movimientoId = null;
        if (Math.abs(diferencia) >= EPS) {
          const mov = await movimientoService.create(
            {
              documento,
              tipo: diferencia > 0 ? 'AJUSTE_ENTRADA' : 'AJUSTE_SALIDA',
              fecha: conteo.fecha,
              almacenUuid: conteo.almacen.uuid,
              articuloUuid: d.articulo.uuid,
              cantidad: Math.abs(diferencia),
              motivoUuid: motivo.uuid,
              observaciones: `Conteo ${documento}${payload.observaciones ? `: ${payload.observaciones}` : ''}`,
            },
            actorId,
            user,
            { transaction: t },
          );
          movimientoId = mov?.id ?? null;
          ajustes += 1;
        }
        await d.update({ saldoCierre: saldo, diferencia, movimientoId }, { transaction: t });
      }
      await conteo.update(
        { estado: 'CERRADO', motivoId: motivo.id, cerradoAt: new Date(), cerradoBy: actorId, updatedBy: actorId, observaciones: payload.observaciones || conteo.observaciones },
        { transaction: t },
      );
      return { uuid: conteo.uuid, documento, estado: 'CERRADO', contados: detalles.length, ajustes };
    });
  },

  async anular(uuid, actorId, user) {
    const conteo = await cargarConteo(uuid, user);
    if (conteo.estado !== 'BORRADOR') throw ApiError.badRequest('Solo se puede anular un conteo en borrador (uno cerrado ya generó ajustes)');
    await conteo.update({ estado: 'ANULADO', updatedBy: actorId });
    return { uuid: conteo.uuid, estado: 'ANULADO' };
  },
};

export default conteoService;
