import { sequelize } from '../../database/connection.js';
import { proformaRepository } from '../../repositories/inventario/proforma.repository.js';
import { Proforma, ProformaDetalle, Articulo, Factura } from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { generarCorrelativo } from '../../utils/correlativo.js';
import { facturaRepository } from '../../repositories/inventario/factura.repository.js';

async function resolveArticulo(uuid) {
  const p = await Articulo.findOne({ where: { uuid } });
  if (!p) throw ApiError.notFound('Artículo no encontrado');
  return p;
}

function calcularTotales(detallesPayload, descuentoGlobal, impuestosGlobal) {
  let subtotal = 0;
  const detallesCalculados = [];
  for (const det of detallesPayload) {
    const cantidad = Number(det.cantidad);
    const precio = Number(det.precioUnitario ?? det.precio ?? 0);
    const descuento = Number(det.descuento || 0);
    const sub = cantidad * precio - descuento;
    if (sub < 0) throw ApiError.badRequest('Subtotal de detalle no puede ser negativo');
    subtotal += sub;
    detallesCalculados.push({ cantidad, precioUnitario: precio, descuento, subtotal: sub, articuloUuid: det.articuloUuid, observaciones: det.observaciones || null });
  }
  const total = subtotal - Number(descuentoGlobal || 0) + Number(impuestosGlobal || 0);
  return { subtotal, total, detallesCalculados };
}

export const proformaService = {
  async list(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await proformaRepository.findAndCountAll({
      limit,
      offset,
      search: query.search,
      estado: query.estado,
      fechaDesde: query.fechaDesde,
      fechaHasta: query.fechaHasta,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getByUuid(uuid) {
    const proforma = await proformaRepository.findByUuid(uuid);
    if (!proforma) throw ApiError.notFound('Proforma no encontrada');
    return proforma;
  },

  async create(payload, actorId) {
    // Normalizar vigencia alias
    const fechaVigencia = payload.fechaVigencia || payload.vigencia || null;
    const descuentoGlobal = Number(payload.descuento || 0);
    const impuestosGlobal = Number(payload.impuestos || 0);

    const { subtotal, total, detallesCalculados } = calcularTotales(payload.detalles, descuentoGlobal, impuestosGlobal);

    return sequelize.transaction(async (t) => {
      const numero = await generarCorrelativo(Proforma, { prefijo: 'PROF', transaction: t });
      const proforma = await proformaRepository.create(
        {
          numero,
          cliente: payload.cliente,
          clienteIdentificacion: payload.clienteIdentificacion || null,
          clienteEmail: payload.clienteEmail || null,
          fecha: payload.fecha,
          fechaVigencia,
          descuento: descuentoGlobal,
          impuestos: impuestosGlobal,
          subtotal,
          total: total < 0 ? 0 : total,
          estado: payload.estado || 'BORRADOR',
          observaciones: payload.observaciones || null,
          usuarioId: actorId,
          createdBy: actorId,
        },
        { transaction: t },
      );

      const detalles = [];
      for (const calc of detallesCalculados) {
        const articulo = await resolveArticulo(calc.articuloUuid);
        detalles.push({
          proformaId: proforma.id,
          articuloId: articulo.id,
          cantidad: calc.cantidad,
          precioUnitario: calc.precioUnitario,
          descuento: calc.descuento,
          subtotal: calc.subtotal,
          observaciones: calc.observaciones,
        });
      }
      if (detalles.length) await ProformaDetalle.bulkCreate(detalles, { transaction: t });

      return proformaRepository.findByUuid(proforma.uuid);
    });
  },

  async update(uuid, payload, actorId) {
    const proforma = await this.getByUuid(uuid);
    if (proforma.estado === 'CONVERTIDA') throw ApiError.badRequest('No se puede editar una proforma convertida');

    return sequelize.transaction(async (t) => {
      let subtotal = Number(proforma.subtotal);
      let total = Number(proforma.total);
      let nuevosDetalles = null;

      if (payload.detalles) {
        const descuentoGlobal = payload.descuento !== undefined ? Number(payload.descuento) : Number(proforma.descuento);
        const impuestosGlobal = payload.impuestos !== undefined ? Number(payload.impuestos) : Number(proforma.impuestos);
        const calc = calcularTotales(payload.detalles, descuentoGlobal, impuestosGlobal);
        subtotal = calc.subtotal;
        total = calc.total < 0 ? 0 : calc.total;
        nuevosDetalles = calc.detallesCalculados;
      } else if (payload.descuento !== undefined || payload.impuestos !== undefined) {
        // Recalcular total con nuevos descuento/impuestos manteniendo subtotal
        const descuentoGlobal = payload.descuento !== undefined ? Number(payload.descuento) : Number(proforma.descuento);
        const impuestosGlobal = payload.impuestos !== undefined ? Number(payload.impuestos) : Number(proforma.impuestos);
        total = Number(proforma.subtotal) - descuentoGlobal + impuestosGlobal;
        if (total < 0) total = 0;
        subtotal = Number(proforma.subtotal);
      }

      const data = {
        ...(payload.cliente ? { cliente: payload.cliente } : {}),
        ...(payload.clienteIdentificacion !== undefined ? { clienteIdentificacion: payload.clienteIdentificacion || null } : {}),
        ...(payload.clienteEmail !== undefined ? { clienteEmail: payload.clienteEmail || null } : {}),
        ...(payload.fecha ? { fecha: payload.fecha } : {}),
        ...((payload.fechaVigencia !== undefined || payload.vigencia !== undefined) ? { fechaVigencia: payload.fechaVigencia || payload.vigencia || null } : {}),
        ...(payload.descuento !== undefined ? { descuento: Number(payload.descuento) } : {}),
        ...(payload.impuestos !== undefined ? { impuestos: Number(payload.impuestos) } : {}),
        ...(payload.detalles || payload.descuento !== undefined || payload.impuestos !== undefined ? { subtotal, total } : {}),
        ...(payload.estado ? { estado: payload.estado } : {}),
        ...(payload.observaciones !== undefined ? { observaciones: payload.observaciones || null } : {}),
        updatedBy: actorId,
      };

      await proformaRepository.update(proforma, data, { transaction: t });

      if (nuevosDetalles) {
        await ProformaDetalle.destroy({ where: { proformaId: proforma.id }, transaction: t });
        const toCreate = [];
        for (const calc of nuevosDetalles) {
          const articulo = await resolveArticulo(calc.articuloUuid);
          toCreate.push({
            proformaId: proforma.id,
            articuloId: articulo.id,
            cantidad: calc.cantidad,
            precioUnitario: calc.precioUnitario,
            descuento: calc.descuento,
            subtotal: calc.subtotal,
            observaciones: calc.observaciones,
          });
        }
        if (toCreate.length) await ProformaDetalle.bulkCreate(toCreate, { transaction: t });
      }

      return proformaRepository.findByUuid(uuid);
    });
  },

  async delete(uuid, actorId) {
    const proforma = await this.getByUuid(uuid);
    if (proforma.estado === 'CONVERTIDA') throw ApiError.badRequest('No se puede eliminar una proforma convertida');
    await proformaRepository.softDelete(proforma, actorId);
  },

  // Convierte la proforma en una factura REAL (persistida en `facturas` +
  // `factura_detalles`, con su propia numeración correlativa FACT-####) —
  // antes esto solo cambiaba el estado y devolvía un objeto en memoria sin
  // guardar nada. Sigue sin afectar inventario (una factura no genera
  // movimientos de stock, solo formaliza la venta ya cotizada).
  async convertir(uuid, actorId) {
    const proforma = await this.getByUuid(uuid);
    if (proforma.estado === 'CONVERTIDA') throw ApiError.badRequest('La proforma ya fue convertida');
    if (proforma.estado === 'CANCELADA' || proforma.estado === 'VENCIDA') throw ApiError.badRequest(`No se puede convertir una proforma en estado ${proforma.estado}`);

    // Defensa extra ante el unique(proforma_id) de `facturas`: si por algún
    // motivo ya existe una factura para esta proforma (no debería, dado el
    // chequeo de estado de arriba, pero evita un 500 feo si pasa) se informa
    // con claridad en vez de dejar reventar el constraint.
    const yaExiste = await facturaRepository.findByProformaId(proforma.id);
    if (yaExiste) throw ApiError.conflict(`Esta proforma ya tiene la factura ${yaExiste.numero}`);

    return sequelize.transaction(async (t) => {
      await proformaRepository.update(proforma, { estado: 'CONVERTIDA', updatedBy: actorId }, { transaction: t });

      const numero = await generarCorrelativo(Factura, { prefijo: 'FACT', transaction: t });
      const factura = await facturaRepository.create(
        {
          numero,
          proformaId: proforma.id,
          cliente: proforma.cliente,
          clienteIdentificacion: proforma.clienteIdentificacion,
          clienteEmail: proforma.clienteEmail,
          fecha: new Date().toISOString().slice(0, 10),
          descuento: proforma.descuento,
          impuestos: proforma.impuestos,
          subtotal: proforma.subtotal,
          total: proforma.total,
          observaciones: `Generada desde proforma ${proforma.numero}`,
          usuarioId: actorId,
          createdBy: actorId,
        },
        { transaction: t },
      );

      const detalles = proforma.detalles.map((d) => ({
        facturaId: factura.id,
        articuloId: d.articuloId,
        cantidad: d.cantidad,
        precioUnitario: d.precioUnitario,
        descuento: d.descuento,
        subtotal: d.subtotal,
        observaciones: d.observaciones,
      }));
      if (detalles.length) await facturaRepository.bulkCreateDetalles(detalles, { transaction: t });

      return factura.uuid;
    }).then(async (facturaUuid) => ({
      // Se lee DESPUÉS de que la transacción confirmó — leer con el mismo
      // `uuid`/`facturaUuid` pero sin pasar `transaction` dentro del
      // callback vería la fila sin commitear todavía bajo REPEATABLE READ.
      proforma: await proformaRepository.findByUuid(uuid),
      factura: await facturaRepository.findByUuid(facturaUuid),
    }));
  },
};

export default proformaService;
