import { sequelize } from '../../database/connection.js';
import { elaboracionRepository } from '../../repositories/inventario/elaboracion.repository.js';
import { MezclaVersion, Mezcla, MezclaComponente, Articulo, UnidadMedida, Almacen, MovimientoInventario, Elaboracion } from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { movimientoService } from './movimiento.service.js';
import { getExistencia, assertStockSuficiente, registrarMovimientoEnCache } from './stock.helper.js';
import { convertirACantidadBase } from '../../utils/unidadConversion.js';
import { generarCorrelativo } from '../../utils/correlativo.js';

export const elaboracionService = {
  async list(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await elaboracionRepository.findAndCountAll({
      limit,
      offset,
      mezclaUuid: query.mezclaUuid,
      mezclaVersionUuid: query.mezclaVersionUuid,
      almacenUuid: query.almacenUuid,
      fechaDesde: query.fechaDesde,
      fechaHasta: query.fechaHasta,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getByUuid(uuid) {
    const elab = await elaboracionRepository.findByUuid(uuid);
    if (!elab) throw ApiError.notFound('Elaboración no encontrada');
    return elab;
  },

  // `forzarSaldoNegativo`: mismo patrón que mezcla.service.js#finalizar y
  // racimoMovimiento.service.js#crearMovimientosEnLote — si algún
  // componente no tiene stock suficiente, no bloquea de una: junta la
  // advertencia y, si no vino `forzarSaldoNegativo: true`, devuelve
  // `{ requiereConfirmacion: true, advertencias, elaboracion: null }` sin
  // escribir nada. El frontend muestra cómo quedaría el saldo y, si
  // confirma, reenvía con `forzarSaldoNegativo: true`.
  //
  // `omitirSalidaComponentes`: usado SOLO por mezcla.service.js#crearElaborado
  // en la conversión de una prueba recién finalizada — los insumos ya se
  // descontaron una vez, al finalizar la prueba (ver
  // mezcla.service.js#finalizar), así que convertirla en elaborado NO debe
  // volver a generar una salida de esos mismos insumos (pedido explícito:
  // "no debería hacer salida de inventario al crear el elaborado" — sería
  // un doble descuento por la misma cantidad física ya consumida). Solo se
  // registra la ENTRADA del artículo elaborado + el documento de
  // elaboración (para trazabilidad y costeo), sin tocar stock de
  // componentes ni volver a validarlo. Una "Nueva elaboración" posterior
  // (producir más, desde el módulo de Elaboraciones) SÍ es una corrida de
  // producción física nueva y sigue consumiendo insumos normalmente — acá
  // el flag va en `false`.
  async create(payload, actorId, { forzarSaldoNegativo = false, omitirSalidaComponentes = false } = {}) {
    const almacen = await Almacen.findOne({ where: { uuid: payload.almacenUuid } });
    if (!almacen) throw ApiError.notFound('Almacén no encontrado');

    const version = await MezclaVersion.findOne({
      where: { uuid: payload.mezclaVersionUuid },
      include: [
        { model: Mezcla, as: 'mezcla', include: [{ model: Articulo, as: 'articuloElaborado' }] },
        { model: MezclaComponente, as: 'componentes', include: [{ model: Articulo, as: 'articulo' }, { model: UnidadMedida, as: 'unidad' }] },
      ],
    });
    if (!version) throw ApiError.notFound('Versión de mezcla no encontrada');
    if (!version.activa) throw ApiError.badRequest('Solo se puede elaborar con una versión activa');

    const mezcla = version.mezcla;
    if (!mezcla) throw ApiError.notFound('Mezcla no encontrada');

    const cantidadElaborada = Number(payload.cantidadElaborada);
    if (cantidadElaborada <= 0) throw ApiError.badRequest('cantidadElaborada debe ser positiva');

    const rendimiento = Number(mezcla.rendimiento || 1);
    const factor = cantidadElaborada / rendimiento;

    // cantidadRequerida: cantidad de receta ya escalada a la producción
    // pedida, en la unidad del COMPONENTE (comp.unidadId) — la que se
    // muestra en el movimiento, para trazabilidad de lo que realmente se
    // recetó. cantidadRequeridaBase: esa misma cantidad convertida a la
    // unidad BASE del artículo (articulo.unidadMedidaId) — la única que
    // puede tocar Existencia/costoCompra, que están expresados en esa
    // unidad base (ver unidadConversion.js). Si el componente se midió en
    // otra unidad sin conversión registrada, esto bloquea con un error
    // claro en vez de descontar/costear con el número equivocado.
    async function calcularDetalle(comp) {
      const cantidadRequerida = Number(comp.cantidad) * factor;
      const cantidadRequeridaBase = await convertirACantidadBase(comp.articulo, comp.unidadId, cantidadRequerida);
      return { comp, cantidadRequerida, cantidadRequeridaBase };
    }
    const detalles = await Promise.all(version.componentes.map(calcularDetalle));

    // Validar stock de cada componente vía movimientoService.getExistencias (FASE 3)
    // Usa el servicio centralizado de movimientos para consultar existencias por almacén/artículo,
    // luego dentro de transacción se re-valida con getSaldo para atomicidad.
    // No lanza directo si falta — junta advertencias (ver forzarSaldoNegativo arriba).
    // Si omitirSalidaComponentes, no hay ninguna salida nueva que validar.
    const advertenciasPrevias = [];
    if (!omitirSalidaComponentes) {
      for (const { comp, cantidadRequeridaBase } of detalles) {
        const existencias = await movimientoService.getExistencias({
          almacenUuid: almacen.uuid,
          articuloUuid: comp.articulo.uuid,
        });
        const saldo = existencias.length ? Number(existencias[0].saldo) : await getExistencia(almacen.id, comp.articuloId);
        if (saldo < cantidadRequeridaBase && !forzarSaldoNegativo) {
          advertenciasPrevias.push({
            articulo: comp.articulo.nombre,
            disponible: saldo,
            requerido: cantidadRequeridaBase,
            saldoResultante: saldo - cantidadRequeridaBase,
            mensaje: `Stock insuficiente para ${comp.articulo.nombre}. Disponible: ${saldo}, requerido: ${cantidadRequeridaBase}. El saldo quedaría en ${saldo - cantidadRequeridaBase}.`,
          });
        }
      }
    }
    if (advertenciasPrevias.length > 0) {
      return { requiereConfirmacion: true, advertencias: advertenciasPrevias, elaboracion: null };
    }

    const fecha = payload.fecha;
    const observaciones = payload.observaciones || null;

    // Costo de cada componente al COSTO ACTUAL del insumo (comp.articulo.costoCompra,
    // expresado por unidad BASE), no el costoUnitarioSnapshot congelado desde
    // que se creó/versionó la mezcla — cada elaboración es un "movimiento"
    // real y debe quedar costeada con el precio vigente al momento de
    // elaborar, guardando ESE valor como histórico en el movimiento/
    // elaboración resultante (que ya no cambia después). El snapshot de
    // mezcla_componentes sigue existiendo como referencia de la receta, pero
    // deja de ser la fuente del costo real.
    let costoTotal = 0;
    for (const { comp, cantidadRequeridaBase } of detalles) {
      const costoUnit = Number(comp.articulo.costoCompra || 0);
      costoTotal += costoUnit * cantidadRequeridaBase;
    }
    const costoUnitario = cantidadElaborada ? costoTotal / cantidadElaborada : 0;

    return sequelize.transaction(async (t) => {
      const documento = payload.documento || (await generarCorrelativo(Elaboracion, { prefijo: 'ELAB', columna: 'documento', transaction: t }));

      if (!omitirSalidaComponentes) {
        // Re-validar stock dentro de transacción, con bloqueo de fila. Si
        // forzarSaldoNegativo es true, el bloqueo de fila se mantiene (para
        // que el descuento en negativo también quede atómico frente a otra
        // transacción concurrente) pero ya no lanza si falta saldo.
        for (const { comp, cantidadRequeridaBase } of detalles) {
          if (forzarSaldoNegativo) {
            await getExistencia(almacen.id, comp.articuloId, { transaction: t, lock: true });
          } else {
            await assertStockSuficiente(almacen.id, comp.articuloId, cantidadRequeridaBase, {
              transaction: t,
              nombreArticulo: comp.articulo.nombre,
              nombreAlmacen: almacen.nombre,
            });
          }
        }

        // Crear movimientos SALIDA para cada componente
        for (const { comp, cantidadRequeridaBase } of detalles) {
          const costoUnit = Number(comp.articulo.costoCompra || 0);
          const costoTot = costoUnit * cantidadRequeridaBase;
          await MovimientoInventario.create(
            {
              documento,
              tipo: 'ELABORACION_SALIDA',
              fecha,
              almacenId: almacen.id,
              articuloId: comp.articuloId,
              // Se guarda en la unidad BASE del artículo (pedido explícito) —
              // aunque el componente se haya medido en otra unidad, el
              // listado de Movimientos debe reflejar la unidad por defecto.
              cantidad: cantidadRequeridaBase,
              cantidadBase: cantidadRequeridaBase,
              unidadId: comp.articulo.unidadMedidaId || comp.unidadId || null,
              costoUnitario: costoUnit,
              costoTotal: costoTot,
              observaciones: observaciones ? `Elaboración ${mezcla.nombre} - componente ${comp.articulo.nombre}` : null,
              usuarioId: actorId,
            },
            { transaction: t },
          );
          await registrarMovimientoEnCache(almacen.id, comp.articuloId, 'ELABORACION_SALIDA', cantidadRequeridaBase, t);
        }
      }

      // Crear movimiento ENTRADA para artículo elaborado
      const articuloElaboradoId = mezcla.articuloElaboradoId;
      await MovimientoInventario.create(
        {
          documento,
          tipo: 'ELABORACION_ENTRADA',
          fecha,
          almacenId: almacen.id,
          articuloId: articuloElaboradoId,
          cantidad: cantidadElaborada,
          cantidadBase: cantidadElaborada,
          unidadId: mezcla.unidadRendimientoId || null,
          costoUnitario,
          costoTotal,
          observaciones: observaciones || `Elaboración ${mezcla.nombre}`,
          usuarioId: actorId,
        },
        { transaction: t },
      );
      await registrarMovimientoEnCache(almacen.id, articuloElaboradoId, 'ELABORACION_ENTRADA', cantidadElaborada, t);

      // Crear registro de elaboración
      const elaboracion = await elaboracionRepository.create(
        {
          documento,
          mezclaVersionId: version.id,
          cantidadElaborada,
          almacenId: almacen.id,
          fecha,
          costoTotal,
          costoUnitario,
          usuarioId: actorId,
          observaciones,
        },
        { transaction: t },
      );

      const elaboracionFinal = await elaboracionRepository.findByUuid(elaboracion.uuid, { transaction: t });
      return { requiereConfirmacion: false, advertencias: [], elaboracion: elaboracionFinal };
    });
  },
};

export default elaboracionService;
