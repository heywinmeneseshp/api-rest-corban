import { sequelize } from '../../database/connection.js';
import { elaboracionRepository } from '../../repositories/inventario/elaboracion.repository.js';
import { MezclaVersion, Mezcla, MezclaComponente, Articulo, UnidadMedida, Almacen, MovimientoInventario, Elaboracion } from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { consumirStockConReceta, RequiereConfirmacionStockError } from './stock.helper.js';
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
  // registra el documento de elaboración (para trazabilidad y costeo), sin
  // tocar stock de componentes ni volver a validarlo. El artículo elaborado
  // NUNCA tiene saldo propio (otro pedido explícito) — nunca se le genera
  // una entrada de inventario. Una "Nueva elaboración" posterior (producir
  // más, desde el módulo de Elaboraciones) SÍ es una corrida de producción
  // física nueva y sigue consumiendo insumos normalmente — acá el flag va
  // en `false`.
  // `transaction`: cuando el caller ya abrió su propia transacción (ver
  // mezcla.service.js#aprobar, que necesita el lock de la MezclaVersion Y
  // la creación de la Elaboración en una sola operación atómica para evitar
  // que dos aprobaciones casi simultáneas dupliquen la Elaboración), se
  // reutiliza esa transacción en vez de abrir una propia — así todo el
  // "aprobar" queda en un único commit/rollback. Si no se pasa, se abre una
  // transacción propia como antes (uso normal desde "Nueva elaboración").
  async create(payload, actorId, { forzarSaldoNegativo = false, omitirSalidaComponentes = false, transaction: externalTransaction = null } = {}) {
    const runner = async (t) => {
      const almacen = await Almacen.findOne({ where: { uuid: payload.almacenUuid }, transaction: t });
      if (!almacen) throw ApiError.notFound('Almacén no encontrado');

      const version = await MezclaVersion.findOne({
        where: { uuid: payload.mezclaVersionUuid },
        include: [
          { model: Mezcla, as: 'mezcla' },
          { model: MezclaComponente, as: 'componentes', include: [{ model: Articulo, as: 'articulo' }, { model: UnidadMedida, as: 'unidad' }] },
        ],
        transaction: t,
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

      const fecha = payload.fecha;
      const observaciones = payload.observaciones || null;

      {
        const documento = payload.documento || (await generarCorrelativo(Elaboracion, { prefijo: 'ELAB', columna: 'documento', transaction: t }));

        // Costo total real: se acumula sobre lo que efectivamente se
        // descuenta en cada INSUMO hoja (no en los componentes de primer
        // nivel, que pueden a su vez ser otro elaborado — ver
        // consumirStockConReceta) — cada elaboración queda costeada con el
        // precio vigente al momento de elaborar.
        let costoTotal = 0;
        const advertencias = [];
        for (const { comp, cantidadRequeridaBase } of detalles) {
          await consumirStockConReceta(almacen.id, comp.articulo, cantidadRequeridaBase, {
            transaction: t,
            // Siempre se fuerza acá adentro — se junta TODA advertencia de
            // toda la receta en una sola pasada; recién afuera se decide
            // si hacía falta forzar de verdad (ver catch más abajo).
            forzarSaldoNegativo: true,
            advertencias,
            // Si omitirSalidaComponentes, los insumos ya se descontaron al
            // finalizar la prueba — acá solo hace falta recorrer la receta
            // para costear, sin volver a tocar stock ni crear movimientos.
            soloCostear: omitirSalidaComponentes,
            onLeafConsumido: async (leafArticulo, leafCantidadBase) => {
              const costoUnit = Number(leafArticulo.costoCompra || 0);
              const costoTot = costoUnit * leafCantidadBase;
              costoTotal += costoTot;
              if (omitirSalidaComponentes) return;
              await MovimientoInventario.create(
                {
                  documento,
                  tipo: 'ELABORACION_SALIDA',
                  fecha,
                  almacenId: almacen.id,
                  articuloId: leafArticulo.id,
                  // Se guarda en la unidad BASE del artículo (pedido
                  // explícito) — aunque se haya medido en otra unidad, el
                  // listado de Movimientos debe reflejar la unidad por
                  // defecto.
                  cantidad: leafCantidadBase,
                  cantidadBase: leafCantidadBase,
                  unidadId: leafArticulo.unidadMedidaId || null,
                  costoUnitario: costoUnit,
                  costoTotal: costoTot,
                  observaciones: observaciones
                    ? `Elaboración ${mezcla.nombre} - insumo ${leafArticulo.nombre}`
                    : null,
                  usuarioId: actorId,
                },
                { transaction: t },
              );
            },
          });
        }

        if (advertencias.length > 0 && !forzarSaldoNegativo) {
          throw new RequiereConfirmacionStockError(advertencias);
        }

        const costoUnitario = cantidadElaborada ? costoTotal / cantidadElaborada : 0;

        // El artículo elaborado NUNCA tiene saldo propio (pedido explícito)
        // — no se genera ninguna ENTRADA de inventario para él acá, solo se
        // deja el registro de la Elaboración (documento + costeo) para
        // trazabilidad; el stock real que se movió es el de los insumos,
        // ya descontado arriba.
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
      }
    };

    // Con transacción externa: se deja que RequiereConfirmacionStockError
    // (y cualquier otro error) se propague tal cual — el caller (aprobar())
    // es quien controla el commit/rollback de esa transacción compartida y
    // decide cómo traducir ese error hacia afuera.
    if (externalTransaction) {
      return runner(externalTransaction);
    }

    try {
      return await sequelize.transaction(runner);
    } catch (err) {
      if (err instanceof RequiereConfirmacionStockError) {
        return { requiereConfirmacion: true, advertencias: err.advertencias, elaboracion: null };
      }
      throw err;
    }
  },
};

export default elaboracionService;
