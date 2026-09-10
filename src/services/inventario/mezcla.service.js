import { sequelize } from '../../database/connection.js';
import { mezclaRepository } from '../../repositories/inventario/mezcla.repository.js';
import {
  Mezcla,
  MezclaVersion,
  MezclaComponente,
  Articulo,
  ArticuloCategoria,
  UnidadMedida,
  Almacen,
  Motivo,
  MovimientoInventario,
} from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { evaluarMargen } from '../../utils/margenComercial.js';
import { assertSinDuplicado } from '../../utils/duplicadoGuard.js';
import { configuracionService } from '../sistema/configuracion.service.js';
import { elaboracionService } from './elaboracion.service.js';
import { articuloService } from './articulo.service.js';
import { registrarMovimientoEnCache, getExistencia } from './stock.helper.js';
import { convertirACantidadBase } from '../../utils/unidadConversion.js';
import { generarCorrelativo } from '../../utils/correlativo.js';
import { cargarFotosMezclaPrueba, eliminarFotoDeDrive, descargarArchivoDeDrive } from '../googleDrive/cargueFotosLabor.js';

const MOTIVO_PRUEBA_MEZCLA_CODIGO = 'PRUEBA_MEZCLA';
// Estados de la prueba en los que todavía se puede editar libremente
// (componentes, etapas, fotos) — una vez finalizada (OPTIMA/NO_VALIDA) o
// convertida en elaborado, queda de solo lectura para no alterar
// retroactivamente un resultado ya cerrado y trazado.
const ESTADOS_EDITABLES = ['BORRADOR', 'EN_PRUEBA'];

async function resolveArticulo(uuid) {
  const p = await Articulo.findOne({ where: { uuid } });
  if (!p) throw ApiError.notFound('Artículo no encontrado');
  return p;
}

async function resolveUnidad(uuid) {
  if (!uuid) return null;
  const u = await UnidadMedida.findOne({ where: { uuid } });
  if (!u) throw ApiError.notFound('Unidad de medida no encontrada');
  return u;
}

async function resolveAlmacen(uuid) {
  if (!uuid) return null;
  const a = await Almacen.findOne({ where: { uuid } });
  if (!a) throw ApiError.notFound('Almacén no encontrado');
  return a;
}

async function calcularCostos(componentesPayload, rendimiento) {
  let costoTotal = 0;
  const detalles = [];
  for (const comp of componentesPayload) {
    const articulo = await resolveArticulo(comp.articuloUuid);
    let unidadId = null;
    if (comp.unidadUuid) {
      const unidad = await resolveUnidad(comp.unidadUuid);
      unidadId = unidad.id;
    }
    const costoUnitarioSnapshot = Number(articulo.costoCompra || 0);
    const cantidad = Number(comp.cantidad);
    const costoTotalSnapshot = costoUnitarioSnapshot * cantidad;
    costoTotal += costoTotalSnapshot;
    detalles.push({
      articuloId: articulo.id,
      cantidad,
      unidadId,
      costoUnitarioSnapshot,
      costoTotalSnapshot,
      articulo,
    });
  }
  const costoUnitario = rendimiento ? costoTotal / Number(rendimiento) : costoTotal;
  return { costoTotal, costoUnitario, detalles };
}

// pH mínimo <= pH <= pH máximo, y CE < CE máxima — nunca hardcodeado, ver
// configuracion.service.js#getMezclaParametros.
function evaluarResultado(ph, ce, parametros) {
  const cumplePh = Number(ph) >= Number(parametros.phMinimo) && Number(ph) <= Number(parametros.phMaximo);
  const cumpleCe = Number(ce) < Number(parametros.ceMaxima);
  return cumplePh && cumpleCe ? 'CUMPLE' : 'NO_CUMPLE';
}

async function getVersionOrFail(versionUuid, { transaction } = {}) {
  const version = await mezclaRepository.findVersionByUuid(versionUuid, { transaction });
  if (!version) throw ApiError.notFound('Prueba de mezcla no encontrada');
  return version;
}

function assertVersionEditable(version) {
  if (!ESTADOS_EDITABLES.includes(version.estadoPrueba)) {
    throw ApiError.badRequest(
      `Esta prueba ya está ${version.estadoPrueba === 'CONVERTIDA' ? 'convertida en elaborado' : 'finalizada'} y no se puede editar`,
    );
  }
}

export const mezclaService = {
  async list(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await mezclaRepository.findAndCountAll({
      limit,
      offset,
      search: query.search,
      estado: query.estado,
      articuloElaboradoUuid: query.articuloElaboradoUuid,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getByUuid(uuid) {
    const mezcla = await mezclaRepository.findByUuid(uuid);
    if (!mezcla) throw ApiError.notFound('Mezcla no encontrada');
    return mezcla;
  },

  // Crea el contenedor (Mezcla) + la primera versión, que ES la prueba de
  // laboratorio (estadoPrueba: BORRADOR). A diferencia del create original,
  // los componentes son OPCIONALES acá (se pueden ir agregando después vía
  // setComponentes) — el operador puede guardar un borrador solo con el
  // almacén de donde va a consumir. El nombre también es opcional acá: se
  // asigna más adelante desde la pantalla de la prueba, y finalizar() sí lo
  // exige. El artículo elaborado (producto) NO se asigna nunca acá — no
  // existe todavía: se CREA a partir de la prueba exitosa, en
  // crearElaborado() (pedido explícito del usuario).
  async create(payload, actorId) {
    const unidad = await resolveUnidad(payload.unidadRendimientoUuid);
    const almacen = await resolveAlmacen(payload.almacenUuid);

    const rendimiento = Number(payload.rendimiento || 1);
    const componentes = payload.componentes || [];
    const { costoTotal, costoUnitario, detalles } = await calcularCostos(componentes, rendimiento);

    return sequelize.transaction(async (t) => {
      // Chequeo de duplicado CON lock, dentro de la misma transacción del
      // create — mezclas.nombre no tiene UNIQUE app-level de sobra (sí a
      // nivel de base, ver migración 20260826000030) y solo aplica si viene
      // nombre: pasar `undefined`/`null` acá haría un WHERE que no filtra
      // por nombre en absoluto, o que bloquearía un segundo borrador sin
      // nombre todavía (MySQL sí permite varios NULL en un UNIQUE, la app
      // no debe ser más estricta que la base).
      if (payload.nombre) {
        await assertSinDuplicado(Mezcla, { nombre: payload.nombre }, t, 'Ya existe una mezcla con ese nombre');
      }

      // El código lo genera el sistema (correlativo MEZ-0001, mismo patrón
      // que usan Elaboraciones/Proformas/Órdenes) — el operador de
      // laboratorio no lo digita.
      const codigo = await generarCorrelativo(Mezcla, { prefijo: 'MEZ', columna: 'codigo', padding: 4, transaction: t });

      const mezcla = await mezclaRepository.create(
        {
          codigo,
          nombre: payload.nombre || null,
          descripcion: payload.descripcion || null,
          articuloElaboradoId: null,
          unidadRendimientoId: unidad?.id || null,
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
          estadoPrueba: 'BORRADOR',
          almacenId: almacen?.id || null,
          createdBy: actorId,
        },
        { transaction: t },
      );

      for (const det of detalles) {
        await MezclaComponente.create(
          {
            mezclaVersionId: version.id,
            articuloId: det.articuloId,
            cantidad: det.cantidad,
            unidadId: det.unidadId,
            costoUnitarioSnapshot: det.costoUnitarioSnapshot,
            costoTotalSnapshot: det.costoTotalSnapshot,
          },
          { transaction: t },
        );
      }

      const resultado = await mezclaRepository.findByUuid(mezcla.uuid, { transaction: t });
      return { ...resultado.toJSON(), advertencias: evaluarMargen(payload.precioVenta, costoUnitario) };
    });
  },

  async update(uuid, payload, actorId) {
    const mezcla = await this.getByUuid(uuid);

    // articuloElaboradoId NO se toca acá — no se asigna manualmente, nace
    // en crearElaborado() a partir de la prueba exitosa.
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
      unidadRendimientoId,
      ...(payload.rendimiento !== undefined ? { rendimiento: Number(payload.rendimiento) } : {}),
      ...(payload.precioVenta !== undefined ? { precioVenta: payload.precioVenta } : {}),
      ...(payload.estado !== undefined ? { estado: payload.estado } : {}),
      updatedBy: actorId,
    };

    // Antes, cambiar `rendimiento` también disparaba una versión nueva
    // (semántica de "receta versionada" de un diseño anterior). En el
    // flujo actual de laboratorio (una Mezcla ≈ una prueba) eso ya no
    // aplica: rendimiento es un campo simple, igual que nombre — se
    // actualiza en el lugar, sin clonar componentes en una versión nueva.
    const necesitaNuevaVersion = payload.componentes !== undefined;

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
        const resultado = await mezclaRepository.findByUuid(uuid, { transaction: t });
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
        componentesPayload = await Promise.all(
          componentesActivos.map(async (c) => {
            const prod = await Articulo.findByPk(c.articuloId, { transaction: t });
            let unidadUuid = null;
            if (c.unidadId) {
              const uni = await UnidadMedida.findByPk(c.unidadId, { transaction: t });
              unidadUuid = uni?.uuid || null;
            }
            return { articuloUuid: prod.uuid, cantidad: Number(c.cantidad), unidadUuid };
          }),
        );
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
          estadoPrueba: 'BORRADOR',
          almacenId: activa?.almacenId || null,
          createdBy: actorId,
        },
        { transaction: t },
      );

      for (const det of detalles) {
        await MezclaComponente.create(
          {
            mezclaVersionId: nuevaVersion.id,
            articuloId: det.articuloId,
            cantidad: det.cantidad,
            unidadId: det.unidadId,
            costoUnitarioSnapshot: det.costoUnitarioSnapshot,
            costoTotalSnapshot: det.costoTotalSnapshot,
          },
          { transaction: t },
        );
      }

      const resultado = await mezclaRepository.findByUuid(uuid, { transaction: t });
      return { ...resultado.toJSON(), advertencias: evaluarMargen(precioVentaFinal, costoUnitario) };
    });
  },

  async delete(uuid, actorId) {
    const mezcla = await this.getByUuid(uuid);
    await mezclaRepository.softDelete(mezcla, actorId);
  },

  // Historial de pruebas (todas las versiones, no solo la activa) con los
  // filtros de fecha/operador/estado/producto/componente pedidos para la
  // vista de Historial.
  async listHistorial(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await mezclaRepository.findVersionesAndCountAll({
      limit,
      offset,
      estadoPrueba: query.estadoPrueba,
      operadorUuid: query.operadorUuid,
      fechaDesde: query.fechaDesde,
      fechaHasta: query.fechaHasta,
      articuloElaboradoUuid: query.articuloElaboradoUuid,
      articuloComponenteUuid: query.articuloComponenteUuid,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  // ─── Prueba de laboratorio (MezclaVersion) ───

  async getVersionByUuid(versionUuid) {
    return getVersionOrFail(versionUuid);
  },

  // Reemplaza los componentes de la versión IN-PLACE (sin versionar) —
  // solo mientras la prueba sigue en BORRADOR/EN_PRUEBA. El costo se sigue
  // calculando y guardando (lo necesita Elaboraciones más adelante), pero
  // no se expone al operador de laboratorio (punto 3 del pedido: nada de
  // costos en la prueba).
  async setComponentes(versionUuid, componentes, actorId) {
    const version = await getVersionOrFail(versionUuid);
    assertVersionEditable(version);
    if (!componentes?.length) throw ApiError.badRequest('Agrega al menos un componente');

    const rendimiento = Number(version.mezcla?.rendimiento || 1);
    const { costoTotal, costoUnitario, detalles } = await calcularCostos(componentes, rendimiento);

    return sequelize.transaction(async (t) => {
      await mezclaRepository.destroyComponentesByVersionId(version.id, { transaction: t });
      for (const det of detalles) {
        await mezclaRepository.createComponente(
          {
            mezclaVersionId: version.id,
            articuloId: det.articuloId,
            cantidad: det.cantidad,
            unidadId: det.unidadId,
            costoUnitarioSnapshot: det.costoUnitarioSnapshot,
            costoTotalSnapshot: det.costoTotalSnapshot,
          },
          { transaction: t },
        );
      }
      await mezclaRepository.updateVersion(version, { costoTotal, costoUnitario, updatedBy: actorId }, { transaction: t });
      return getVersionOrFail(versionUuid, { transaction: t });
    });
  },

  // Agrega una etapa de medición ACUMULATIVA: qué componente se acaba de
  // incorporar (opcional) + pH + CE medidos en ese punto. El resultado de
  // la etapa se calcula y persiste con los parámetros VIGENTES en este
  // momento (no espera a "finalizar") — es informativo por etapa; el
  // resultado que realmente decide la prueba es el de la ÚLTIMA etapa, al
  // finalizar.
  async agregarEtapa(versionUuid, payload, actorId) {
    const version = await getVersionOrFail(versionUuid);
    assertVersionEditable(version);

    let componenteId = null;
    if (payload.componenteUuid) {
      const comp = (version.componentes || []).find((c) => c.uuid === payload.componenteUuid);
      if (!comp) throw ApiError.notFound('Componente no encontrado en esta prueba');
      componenteId = comp.id;
    }

    const parametros = await configuracionService.getMezclaParametros();
    const resultado = evaluarResultado(payload.ph, payload.ce, parametros);
    const numero = (await mezclaRepository.countEtapas(version.id)) + 1;

    return sequelize.transaction(async (t) => {
      await mezclaRepository.createEtapa(
        {
          mezclaVersionId: version.id,
          numero,
          componenteId,
          ph: payload.ph,
          ce: payload.ce,
          resultado,
          observaciones: payload.observaciones || null,
          medidoEn: payload.medidoEn || new Date(),
          createdBy: actorId,
        },
        { transaction: t },
      );
      if (version.estadoPrueba === 'BORRADOR') {
        await mezclaRepository.updateVersion(version, { estadoPrueba: 'EN_PRUEBA' }, { transaction: t });
      }
      return getVersionOrFail(versionUuid, { transaction: t });
    });
  },

  // Elimina una etapa cargada por error mientras la prueba sigue editable
  // — renumera las etapas restantes para que el "#" quede sin huecos (ej.
  // 1,2,3,4 con la 3 eliminada pasa a 1,2,3). Las fotos que estaban
  // asociadas a esa etapa NO se borran: quedan sueltas como evidencia
  // general de la prueba (mezcla_fotos.mezcla_etapa_id se libera solo por
  // el ON DELETE SET NULL de la FK).
  async eliminarEtapa(etapaUuid) {
    const etapa = await mezclaRepository.findEtapaByUuid(etapaUuid);
    if (!etapa) throw ApiError.notFound('Etapa no encontrada');

    const version = await MezclaVersion.findByPk(etapa.mezclaVersionId);
    if (!version) throw ApiError.notFound('Prueba de mezcla no encontrada');
    assertVersionEditable(version);

    return sequelize.transaction(async (t) => {
      await mezclaRepository.destroyEtapa(etapa, { transaction: t });

      const restantes = await mezclaRepository.findEtapasByVersionId(version.id, { transaction: t });
      let numero = 1;
      for (const e of restantes) {
        if (e.numero !== numero) {
          await mezclaRepository.updateEtapa(e, { numero }, { transaction: t });
        }
        numero += 1;
      }

      // Si ya no quedan etapas, la prueba vuelve a BORRADOR (el auto-avance
      // a EN_PRUEBA en agregarEtapa() se deshace si esa era la única etapa).
      if (!restantes.length && version.estadoPrueba === 'EN_PRUEBA') {
        await mezclaRepository.updateVersion(version, { estadoPrueba: 'BORRADOR' }, { transaction: t });
      }

      return getVersionOrFail(version.uuid, { transaction: t });
    });
  },

  async subirFotos(versionUuid, archivos, actorId, etapaUuid) {
    const version = await getVersionOrFail(versionUuid);
    assertVersionEditable(version);

    let mezclaEtapaId = null;
    if (etapaUuid) {
      const etapa = (version.etapas || []).find((e) => e.uuid === etapaUuid);
      if (!etapa) throw ApiError.notFound('Etapa no encontrada en esta prueba');
      mezclaEtapaId = etapa.id;
    }

    const resultado = await cargarFotosMezclaPrueba(
      { documento: version.uuid.slice(0, 8), mezclaNombre: version.mezcla?.nombre || 'mezcla' },
      archivos,
    );

    for (const foto of resultado.fotos) {
      await mezclaRepository.createFoto({
        mezclaVersionId: version.id,
        mezclaEtapaId,
        idDrive: foto.idDrive,
        urlDrive: foto.urlDrive,
        nombreOriginal: foto.nombreOriginal,
        nombreDrive: foto.nombreDrive,
        createdBy: actorId,
      });
    }

    return getVersionOrFail(versionUuid);
  },

  async obtenerContenidoFoto(fotoUuid) {
    const foto = await mezclaRepository.findFotoByUuid(fotoUuid);
    if (!foto) throw ApiError.notFound('Foto no encontrada');
    const { stream, mimeType, nombre } = await descargarArchivoDeDrive(foto.idDrive);
    return { stream, mimeType, nombre: nombre || foto.nombreOriginal };
  },

  async eliminarFoto(fotoUuid) {
    const foto = await mezclaRepository.findFotoByUuid(fotoUuid);
    if (!foto) throw ApiError.notFound('Foto no encontrada');
    const version = await MezclaVersion.findByPk(foto.mezclaVersionId);
    if (version && !ESTADOS_EDITABLES.includes(version.estadoPrueba)) {
      throw ApiError.badRequest('Esta prueba ya está finalizada — no se pueden quitar fotos');
    }
    await eliminarFotoDeDrive(foto.idDrive);
    await mezclaRepository.destroyFoto(foto);
  },

  // Cierra la prueba: toma pH/CE de la ÚLTIMA etapa como resultado final,
  // snapshotea los parámetros vigentes, determina válida/no válida, y
  // genera la salida de inventario real por cada componente (punto 15-19
  // del pedido) — con guardia anti-doble-descuento (movimientoDocumento
  // único, solo se genera una vez).
  // `forzarSaldoNegativo`: igual que el patrón ya usado en
  // racimoMovimiento.service.js#crearMovimientosEnLote — si algún
  // componente no tiene stock suficiente, esto NO bloquea de una: se
  // junta como advertencia y, si no vino `forzarSaldoNegativo: true`, se
  // devuelve `{ requiereConfirmacion: true, advertencias, version: null }`
  // SIN escribir nada (dentro de una transacción que no llega a insertar
  // — el commit no hace daño). El frontend le muestra al operador cómo
  // quedaría el saldo y, si confirma, reenvía la misma llamada con
  // `forzarSaldoNegativo: true` y ahí sí se descuenta en negativo.
  async finalizar(versionUuid, actorId, { forzarSaldoNegativo = false } = {}) {
    const version = await getVersionOrFail(versionUuid);
    assertVersionEditable(version);

    if (!version.componentes?.length) throw ApiError.badRequest('La prueba no tiene componentes registrados');
    if (!version.etapas?.length) throw ApiError.badRequest('La prueba no tiene ninguna etapa de medición registrada');
    if (!version.almacenId) throw ApiError.badRequest('La prueba no tiene almacén de origen — no se puede descontar inventario');
    // El nombre es opcional al crear la prueba (se asigna más adelante),
    // pero ya no puede faltar al cerrarla: la prueba finalizada queda fija
    // en el historial/trazabilidad. El artículo elaborado NO se exige
    // acá — todavía no existe: nace en crearElaborado() a partir de la
    // prueba ya finalizada y ÓPTIMA.
    if (!version.mezcla?.nombre) throw ApiError.badRequest('Asigna un nombre a la prueba antes de finalizarla');

    const ultimaEtapa = version.etapas[version.etapas.length - 1];
    const parametros = await configuracionService.getMezclaParametros();
    const resultadoFinal = evaluarResultado(ultimaEtapa.ph, ultimaEtapa.ce, parametros);
    const estadoPrueba = resultadoFinal === 'CUMPLE' ? 'OPTIMA' : 'NO_VALIDA';

    const motivo = await Motivo.findOne({ where: { codigo: MOTIVO_PRUEBA_MEZCLA_CODIGO } });

    return sequelize.transaction(async (t) => {
      // Re-chequeo dentro de la transacción — evita doble descuento si dos
      // requests llegan casi al mismo tiempo (el mismo criterio que
      // assertStockSuficiente usa lock de fila, acá el propio estado de la
      // versión hace de guardia).
      const fresh = await MezclaVersion.findByPk(version.id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!ESTADOS_EDITABLES.includes(fresh.estadoPrueba)) {
        throw ApiError.conflict('Esta prueba ya fue finalizada');
      }

      const documento = await generarCorrelativo(MezclaVersion, { prefijo: 'MIX', columna: 'movimientoDocumento', padding: 4, transaction: t });

      // Convierte cada componente a la unidad BASE del artículo antes de
      // tocar inventario — el operador puede haber medido en una unidad
      // distinta a la que el artículo lleva en Existencia (ver
      // unidadConversion.js). `cantidad`/`unidadId` en el movimiento
      // quedan como se registraron (trazabilidad de lo que realmente se
      // midió); `cantidadBase` es la que de verdad descuenta el saldo.
      const detalles = [];
      for (const comp of version.componentes) {
        const cantidadBase = await convertirACantidadBase(comp.articulo, comp.unidadId, comp.cantidad, { transaction: t });
        detalles.push({ comp, cantidadBase });
      }

      const advertencias = [];
      for (const { comp, cantidadBase } of detalles) {
        // Lock de fila (igual que assertStockSuficiente) para que el check
        // y el insert queden atómicos frente a otra transacción concurrente
        // — pero acá, en vez de lanzar directo, se junta como advertencia
        // cuando no viene forzarSaldoNegativo.
        const saldo = await getExistencia(version.almacenId, comp.articuloId, { transaction: t, lock: true });
        if (saldo < cantidadBase) {
          if (!forzarSaldoNegativo) {
            advertencias.push({
              articulo: comp.articulo?.nombre,
              disponible: saldo,
              requerido: cantidadBase,
              saldoResultante: saldo - cantidadBase,
              mensaje: `Stock insuficiente para ${comp.articulo?.nombre} en almacén ${version.almacen?.nombre}. Disponible: ${saldo}, requerido: ${cantidadBase}. El saldo quedaría en ${saldo - cantidadBase}.`,
            });
          }
        }
      }

      if (advertencias.length > 0 && !forzarSaldoNegativo) {
        // No se escribió nada todavía — el commit de esta transacción no
        // hace ningún daño, simplemente no insertó filas.
        return { requiereConfirmacion: true, advertencias, version: null };
      }

      for (const { comp, cantidadBase } of detalles) {
        // costoUnitarioSnapshot ya es "costo por unidad BASE" (viene
        // directo de articulo.costoCompra, ver calcularCostos() en
        // setComponentes) — el total sí hay que recalcularlo contra
        // cantidadBase, no contra comp.cantidad (que puede estar en otra
        // unidad y dar un total equivocado).
        const costoUnit = Number(comp.costoUnitarioSnapshot || 0);
        await MovimientoInventario.create(
          {
            documento,
            tipo: 'SALIDA',
            fecha: new Date().toISOString().slice(0, 10),
            almacenId: version.almacenId,
            articuloId: comp.articuloId,
            // Se guarda en la unidad BASE del artículo — pedido explícito:
            // aunque se haya medido en otra unidad, el listado de
            // Movimientos debe reflejar la unidad por defecto del artículo.
            cantidad: cantidadBase,
            cantidadBase,
            unidadId: comp.articulo?.unidadMedidaId || comp.unidadId || null,
            costoUnitario: costoUnit,
            costoTotal: costoUnit * cantidadBase,
            motivoId: motivo?.id || null,
            observaciones: `Prueba de mezcla ${version.mezcla?.nombre || ''} — ${documento}`,
            usuarioId: actorId,
          },
          { transaction: t },
        );
        await registrarMovimientoEnCache(version.almacenId, comp.articuloId, 'SALIDA', cantidadBase, t);
      }

      await mezclaRepository.updateVersion(
        fresh,
        {
          estadoPrueba,
          phFinal: ultimaEtapa.ph,
          ceFinal: ultimaEtapa.ce,
          parametrosUsados: parametros,
          movimientoDocumento: documento,
          updatedBy: actorId,
        },
        { transaction: t },
      );

      const versionFinal = await getVersionOrFail(versionUuid, { transaction: t });
      return { requiereConfirmacion: false, advertencias: [], version: versionFinal };
    });
  },

  // Solo disponible cuando la prueba quedó ÓPTIMA — reutiliza tal cual el
  // proceso de Elaboraciones ya existente (su propio consumo de inventario
  // a escala de producción, totalmente separado del consumo de laboratorio
  // ya descontado en finalizar()).
  async crearElaborado(versionUuid, payload, actorId) {
    const version = await getVersionOrFail(versionUuid);
    if (version.estadoPrueba !== 'OPTIMA') {
      throw ApiError.badRequest('Solo una prueba ÓPTIMA puede convertirse en elaborado');
    }
    if (version.elaboracionId) {
      throw ApiError.conflict('Esta prueba ya generó un elaborado');
    }

    // El artículo elaborado (producto) nace acá, a partir de la prueba ya
    // finalizada y ÓPTIMA — no se elige uno existente (pedido explícito:
    // "el artículo elaborado se debe crear a partir de la prueba
    // exitosa"). Reutiliza articuloService.create() tal cual, mismo
    // patrón de esta sesión de no duplicar lógica de creación. Si la
    // mezcla ya tiene un articuloElaboradoId (reintento tras un fallo
    // parcial de elaboracionService.create más abajo, ej. stock
    // insuficiente), se reutiliza en vez de crear un artículo duplicado.
    let articuloElaboradoId = version.mezcla?.articuloElaboradoId || null;
    if (!articuloElaboradoId) {
      if (!payload.articuloNombre || !payload.articuloCategoriaUuid) {
        throw ApiError.badRequest('Indica el nombre y la categoría del artículo elaborado a crear');
      }
      const categoria = await ArticuloCategoria.findOne({ where: { uuid: payload.articuloCategoriaUuid } });
      if (!categoria) throw ApiError.notFound('Categoría no encontrada');
      if (categoria.tipo !== 'ELABORADO') {
        throw ApiError.badRequest('La categoría del artículo elaborado debe ser de tipo Elaborado');
      }

      const nuevoArticulo = await articuloService.create(
        {
          nombre: payload.articuloNombre,
          codigo: payload.articuloCodigo || null,
          categoriaUuid: payload.articuloCategoriaUuid,
          unidadMedidaUuid: payload.articuloUnidadMedidaUuid || null,
          costoCompra: 0,
          precioVenta: payload.articuloPrecioVenta ?? 0,
          estado: true,
        },
        actorId,
      );
      articuloElaboradoId = nuevoArticulo.id;
      // El rendimiento (y su unidad) de la receta se establecen ACÁ, con
      // la cantidad que el operador acaba de indicar que produjo esta
      // prueba — no se le pide por separado en "Información general"
      // (confundía: dos lugares pidiendo lo mismo). De acá en más,
      // elaboracionService.create() usa este rendimiento como el "1x" de
      // la receta para escalar producciones futuras.
      await mezclaRepository.update(version.mezcla, {
        articuloElaboradoId,
        rendimiento: Number(payload.cantidadElaborada),
        unidadRendimientoId: nuevoArticulo.unidadMedidaId || null,
        updatedBy: actorId,
      });
    }

    const resultado = await elaboracionService.create(
      {
        mezclaVersionUuid: version.uuid,
        cantidadElaborada: payload.cantidadElaborada,
        almacenUuid: payload.almacenUuid,
        fecha: payload.fecha,
        observaciones: payload.observaciones,
      },
      actorId,
      // omitirSalidaComponentes: los insumos ya se descontaron una vez al
      // finalizar la prueba (arriba, en finalizar()) — esta conversión no
      // debe volver a generar esa misma salida (pedido explícito, evita
      // doble descuento). Solo registra la entrada del artículo elaborado.
      { forzarSaldoNegativo: payload.forzarSaldoNegativo === true, omitirSalidaComponentes: true },
    );

    // Igual que finalizar(): si falta stock y no vino forzarSaldoNegativo,
    // no se escribió ningún movimiento/elaboración todavía (el artículo
    // elaborado, si se acaba de crear arriba, sí queda persistido — un
    // reintento lo reutiliza en vez de duplicarlo). Se le devuelve la
    // advertencia al frontend para que confirme y reenvíe con
    // forzarSaldoNegativo: true.
    if (resultado.requiereConfirmacion) {
      return { requiereConfirmacion: true, advertencias: resultado.advertencias, version: null };
    }

    await mezclaRepository.updateVersion(
      version,
      { estadoPrueba: 'CONVERTIDA', elaboracionId: resultado.elaboracion.id, updatedBy: actorId },
    );

    const versionFinal = await getVersionOrFail(versionUuid);
    return { requiereConfirmacion: false, advertencias: [], version: versionFinal };
  },
};

export default mezclaService;
