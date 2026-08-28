import { sequelize } from '../../database/connection.js';
import { mezclaRepository } from '../../repositories/inventario/mezcla.repository.js';
import { Mezcla, MezclaVersion, MezclaComponente, Producto, UnidadMedida } from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { evaluarMargen } from '../../utils/margenComercial.js';
import { assertSinDuplicado } from '../../utils/duplicadoGuard.js';

async function resolveProducto(uuid) {
  const p = await Producto.findOne({ where: { uuid } });
  if (!p) throw ApiError.notFound('Producto no encontrado');
  return p;
}

async function resolveUnidad(uuid) {
  if (!uuid) return null;
  const u = await UnidadMedida.findOne({ where: { uuid } });
  if (!u) throw ApiError.notFound('Unidad de medida no encontrada');
  return u;
}

async function calcularCostos(componentesPayload, rendimiento) {
  let costoTotal = 0;
  const detalles = [];
  for (const comp of componentesPayload) {
    const producto = await resolveProducto(comp.productoUuid);
    let unidadId = null;
    if (comp.unidadUuid) {
      const unidad = await resolveUnidad(comp.unidadUuid);
      unidadId = unidad.id;
    }
    const costoUnitarioSnapshot = Number(producto.costoCompra || 0);
    const cantidad = Number(comp.cantidad);
    const costoTotalSnapshot = costoUnitarioSnapshot * cantidad;
    costoTotal += costoTotalSnapshot;
    detalles.push({
      productoId: producto.id,
      cantidad,
      unidadId,
      costoUnitarioSnapshot,
      costoTotalSnapshot,
      producto,
    });
  }
  const costoUnitario = rendimiento ? costoTotal / Number(rendimiento) : costoTotal;
  return { costoTotal, costoUnitario, detalles };
}

export const mezclaService = {
  async list(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await mezclaRepository.findAndCountAll({
      limit,
      offset,
      search: query.search,
      estado: query.estado,
      productoElaboradoUuid: query.productoElaboradoUuid,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getByUuid(uuid) {
    const mezcla = await mezclaRepository.findByUuid(uuid);
    if (!mezcla) throw ApiError.notFound('Mezcla no encontrada');
    return mezcla;
  },

  async create(payload, actorId) {
    const productoElaborado = await resolveProducto(payload.productoElaboradoUuid);
    let unidadRendimientoId = null;
    if (payload.unidadRendimientoUuid) {
      const unidad = await resolveUnidad(payload.unidadRendimientoUuid);
      unidadRendimientoId = unidad.id;
    }

    const rendimiento = Number(payload.rendimiento);
    const { costoTotal, costoUnitario, detalles } = await calcularCostos(payload.componentes, rendimiento);

    return sequelize.transaction(async (t) => {
      // Chequeo de duplicado CON lock, dentro de la misma transacción del
      // create — antes era un check-then-act suelto antes de abrir la
      // transacción, y mezclas.nombre/codigo no tienen UNIQUE en la base
      // (a diferencia de producto_categorias/unidades_medida/productos).
      await assertSinDuplicado(Mezcla, { nombre: payload.nombre }, t, 'Ya existe una mezcla con ese nombre');
      if (payload.codigo) {
        await assertSinDuplicado(Mezcla, { codigo: payload.codigo }, t, 'Ya existe una mezcla con ese código');
      }

      const mezcla = await mezclaRepository.create(
        {
          codigo: payload.codigo || null,
          nombre: payload.nombre,
          descripcion: payload.descripcion || null,
          productoElaboradoId: productoElaborado.id,
          unidadRendimientoId,
          rendimiento,
          precioVenta: payload.precioVenta ?? 0,
          estado: payload.estado ?? true,
          createdBy: actorId,
        },
        { transaction: t },
      );

      const version = await MezclaVersion.create(
        {
          mezclaId: mezcla.id,
          version: 1,
          activa: true,
          costoTotal,
          costoUnitario,
          createdBy: actorId,
        },
        { transaction: t },
      );

      for (const det of detalles) {
        await MezclaComponente.create(
          {
            mezclaVersionId: version.id,
            productoId: det.productoId,
            cantidad: det.cantidad,
            unidadId: det.unidadId,
            costoUnitarioSnapshot: det.costoUnitarioSnapshot,
            costoTotalSnapshot: det.costoTotalSnapshot,
          },
          { transaction: t },
        );
      }

      const resultado = await mezclaRepository.findByUuid(mezcla.uuid);
      return { ...resultado.toJSON(), advertencias: evaluarMargen(payload.precioVenta, costoUnitario) };
    });
  },

  async update(uuid, payload, actorId) {
    const mezcla = await this.getByUuid(uuid);

    let productoElaboradoId = mezcla.productoElaboradoId;
    if (payload.productoElaboradoUuid) {
      const p = await resolveProducto(payload.productoElaboradoUuid);
      productoElaboradoId = p.id;
    }
    let unidadRendimientoId = mezcla.unidadRendimientoId;
    if (payload.unidadRendimientoUuid !== undefined) {
      if (!payload.unidadRendimientoUuid) unidadRendimientoId = null;
      else {
        const u = await resolveUnidad(payload.unidadRendimientoUuid);
        unidadRendimientoId = u.id;
      }
    }

    const data = {
      ...(payload.codigo !== undefined ? { codigo: payload.codigo || null } : {}),
      ...(payload.nombre ? { nombre: payload.nombre } : {}),
      ...(payload.descripcion !== undefined ? { descripcion: payload.descripcion || null } : {}),
      productoElaboradoId,
      unidadRendimientoId,
      ...(payload.rendimiento !== undefined ? { rendimiento: Number(payload.rendimiento) } : {}),
      ...(payload.precioVenta !== undefined ? { precioVenta: payload.precioVenta } : {}),
      ...(payload.estado !== undefined ? { estado: payload.estado } : {}),
      updatedBy: actorId,
    };

    const necesitaNuevaVersion = payload.componentes !== undefined || payload.rendimiento !== undefined;

    const precioVentaFinal = payload.precioVenta !== undefined ? payload.precioVenta : mezcla.precioVenta;

    return sequelize.transaction(async (t) => {
      if (payload.nombre) {
        await assertSinDuplicado(Mezcla, { nombre: payload.nombre }, t, 'Ya existe una mezcla con ese nombre', mezcla.id);
      }
      if (payload.codigo) {
        await assertSinDuplicado(Mezcla, { codigo: payload.codigo }, t, 'Ya existe una mezcla con ese código', mezcla.id);
      }

      await mezclaRepository.update(mezcla, data, { transaction: t });

      if (!necesitaNuevaVersion) {
        // No se recalculan componentes/costo — se compara contra el costo
        // de la versión activa actual (no cambió).
        const activaActual = await mezclaRepository.findActiveVersion(mezcla.id, { transaction: t });
        const resultado = await mezclaRepository.findByUuid(uuid);
        return { ...resultado.toJSON(), advertencias: evaluarMargen(precioVentaFinal, activaActual?.costoUnitario) };
      }

      // Obtener versión activa actual
      const activa = await mezclaRepository.findActiveVersion(mezcla.id, { transaction: t });
      let componentesPayload;
      let rendimientoNuevo = payload.rendimiento !== undefined ? Number(payload.rendimiento) : Number(mezcla.rendimiento);

      if (payload.componentes) {
        componentesPayload = payload.componentes;
      } else if (activa) {
        const componentesActivos = await MezclaComponente.findAll({ where: { mezclaVersionId: activa.id }, transaction: t });
        // Necesitamos mapear a payload con uuids
        componentesPayload = await Promise.all(
          componentesActivos.map(async (c) => {
            const prod = await Producto.findByPk(c.productoId, { transaction: t });
            let unidadUuid = null;
            if (c.unidadId) {
              const uni = await UnidadMedida.findByPk(c.unidadId, { transaction: t });
              unidadUuid = uni?.uuid || null;
            }
            return {
              productoUuid: prod.uuid,
              cantidad: Number(c.cantidad),
              unidadUuid,
            };
          }),
        );
        // si el rendimiento viene de payload ya actualizado, usar ese
        if (payload.rendimiento !== undefined) rendimientoNuevo = Number(payload.rendimiento);
      } else {
        throw ApiError.badRequest('No hay versión activa previa para clonar componentes');
      }

      const { costoTotal, costoUnitario, detalles } = await calcularCostos(componentesPayload, rendimientoNuevo);

      if (activa) {
        await activa.update({ activa: false }, { transaction: t });
      }

      const nuevoVersionNum = activa ? activa.version + 1 : 1;
      const nuevaVersion = await MezclaVersion.create(
        {
          mezclaId: mezcla.id,
          version: nuevoVersionNum,
          activa: true,
          costoTotal,
          costoUnitario,
          createdBy: actorId,
        },
        { transaction: t },
      );

      for (const det of detalles) {
        await MezclaComponente.create(
          {
            mezclaVersionId: nuevaVersion.id,
            productoId: det.productoId,
            cantidad: det.cantidad,
            unidadId: det.unidadId,
            costoUnitarioSnapshot: det.costoUnitarioSnapshot,
            costoTotalSnapshot: det.costoTotalSnapshot,
          },
          { transaction: t },
        );
      }

      const resultado = await mezclaRepository.findByUuid(uuid);
      return { ...resultado.toJSON(), advertencias: evaluarMargen(precioVentaFinal, costoUnitario) };
    });
  },

  async delete(uuid, actorId) {
    const mezcla = await this.getByUuid(uuid);
    await mezclaRepository.softDelete(mezcla, actorId);
  },
};

export default mezclaService;
