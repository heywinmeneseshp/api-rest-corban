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
import { consumirStockConReceta, RequiereConfirmacionStockError } from './stock.helper.js';
import { convertirACantidadBase, resolverFactorConversion } from '../../utils/unidadConversion.js';
import { generarCorrelativo } from '../../utils/correlativo.js';
import { cargarFotosMezclaPrueba, eliminarFotoDeDrive, descargarArchivoDeDrive } from '../googleDrive/cargueFotosLabor.js';

const MOTIVO_PRUEBA_MEZCLA_CODIGO = 'PRUEBA_MEZCLA';
// Estados de la prueba en los que todavía se puede editar libremente
// (componentes, etapas, fotos) — una vez finalizada (OPTIMA/NO_VALIDA) o
// convertida en elaborado, queda de solo lectura para no alterar
// retroactivamente un resultado ya cerrado y trazado.
const ESTADOS_EDITABLES = ['BORRADOR', 'EN_PRUEBA'];

// Los 3 puntos de control de la prueba de homogeneidad que finalizar()
// exige tener registrados (y sin ninguno fallido) antes de cerrar la
// prueba — mismo listado que INTERVALOS_HOMOGENEIDAD en el frontend.
const INTERVALOS_HOMOGENEIDAD = ['15MIN', '30MIN', '60MIN'];

// Valor por defecto de "Volumen por hectárea" (ver elaboraciones/page.js)
// para un elaborado recién aprobado que todavía no tiene ninguno cargado a
// mano — pedido explícito: 6 galones/ha, pero SIEMPRE convertido y
// guardado en Litros (no en Galones), para que quede en la misma unidad
// sin importar qué haya elegido el operador para otras mezclas.
const DOSIS_POR_HECTAREA_DEFAULT_GALONES = 6;

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

const REGULADOR_PH_NOMBRE = 'Regulador de pH';
const REGULADOR_PH_CATEGORIA = 'Insumo Corbana';
const REGULADOR_PH_UNIDAD_CODIGO = 'Kg';

// El insumo de corrección de pH es siempre "Regulador de pH" (pedido
// explícito: no se elige otro) — si todavía no existe en el catálogo (ej.
// primera vez que se usa en un servidor nuevo, antes de que corra el
// seeder), se crea acá solo, sin pedirle al operador que lo haga a mano
// desde Maestros → Artículos.
async function resolveOrCrearReguladorPh(actorId) {
  const existente = await Articulo.findOne({ where: { nombre: REGULADOR_PH_NOMBRE } });
  if (existente) return existente;

  const categoria = await ArticuloCategoria.findOne({ where: { nombre: REGULADOR_PH_CATEGORIA } });
  const unidad = await UnidadMedida.findOne({ where: { codigo: REGULADOR_PH_UNIDAD_CODIGO } });
  try {
    return await articuloService.create(
      {
        nombre: REGULADOR_PH_NOMBRE,
        categoriaUuid: categoria?.uuid || null,
        unidadMedidaUuid: unidad?.uuid || null,
        costoCompra: 0,
        precioVenta: 0,
        manejaInventario: true,
        estado: true,
      },
      actorId,
    );
  } catch (err) {
    // Dos correcciones de pH casi simultáneas, ambas sin el artículo
    // creado todavía, pueden chocar contra el nombre único — la segunda
    // simplemente reusa el que la primera acaba de crear.
    const yaCreado = await Articulo.findOne({ where: { nombre: REGULADOR_PH_NOMBRE } });
    if (yaCreado) return yaCreado;
    throw err;
  }
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
    const cantidad = Number(comp.cantidad);
    // costoCompra está expresado en la unidad BASE del artículo — si el
    // insumo se cargó en otra unidad (ej. ml en la receta, L en el
    // artículo), hay que convertir antes de costear, si no el costo queda
    // multiplicado/dividido por el factor de conversión (ej. 100 ml
    // tratados como si fueran 100 L). Mismo criterio que ya usa
    // consumirStockConReceta al descontar stock.
    const cantidadBase = await convertirACantidadBase(articulo, unidadId, cantidad);
    const costoUnitarioSnapshot = Number(articulo.costoCompra || 0);
    const costoTotalSnapshot = costoUnitarioSnapshot * cantidadBase;
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
// Devuelve el resultado global MÁS el detalle de qué condición falló — el
// pH se puede corregir con el Regulador de pH, la CE no tiene forma de
// corregirse en esta prueba, así que el llamador necesita distinguir cuál
// de las dos fue la que no cumplió.
function evaluarResultadoDetalle(ph, ce, parametros) {
  const cumplePh = Number(ph) >= Number(parametros.phMinimo) && Number(ph) <= Number(parametros.phMaximo);
  const cumpleCe = Number(ce) < Number(parametros.ceMaxima);
  return { resultado: cumplePh && cumpleCe ? 'CUMPLE' : 'NO_CUMPLE', cumplePh, cumpleCe };
}

function evaluarResultado(ph, ce, parametros) {
  return evaluarResultadoDetalle(ph, ce, parametros).resultado;
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
      incluirDirectas: query.incluirDirectas,
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
          dosisPorHectarea: payload.dosisPorHectarea ?? null,
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

    let dosisPorHectareaUnidadId = mezcla.dosisPorHectareaUnidadId;
    if (payload.dosisPorHectareaUnidadUuid !== undefined) {
      if (!payload.dosisPorHectareaUnidadUuid) dosisPorHectareaUnidadId = null;
      else {
        const u = await resolveUnidad(payload.dosisPorHectareaUnidadUuid);
        dosisPorHectareaUnidadId = u.id;
      }
    }

    const data = {
      ...(payload.codigo !== undefined ? { codigo: payload.codigo || null } : {}),
      ...(payload.nombre ? { nombre: payload.nombre } : {}),
      ...(payload.descripcion !== undefined ? { descripcion: payload.descripcion || null } : {}),
      unidadRendimientoId,
      ...(payload.rendimiento !== undefined ? { rendimiento: Number(payload.rendimiento) } : {}),
      ...(payload.dosisPorHectarea !== undefined ? { dosisPorHectarea: payload.dosisPorHectarea } : {}),
      ...(payload.dosisPorHectareaUnidadUuid !== undefined ? { dosisPorHectareaUnidadId } : {}),
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

  // Agrega UN insumo nuevo a la receta sin tocar los que ya existen — a
  // diferencia de setComponentes (que destruye y recrea TODA la lista),
  // esto preserva el id de los componentes ya guardados. Importante: una
  // MezclaEtapa puede tener su `componenteId` apuntando a una fila ya
  // guardada (ver agregarEtapa) — destruir y recrear esa fila (como hacía
  // antes el flujo de "Agregar insumo" del frontend, llamando a
  // setComponentes con la lista completa) le cambia el id por debajo y
  // esa etapa vieja pierde la referencia, mostrando "—" en vez del
  // insumo (bug real, reportado por el usuario).
  async agregarComponente(versionUuid, payload, actorId) {
    const version = await getVersionOrFail(versionUuid);
    assertVersionEditable(version);

    const rendimiento = Number(version.mezcla?.rendimiento || 1);
    const existentes = (version.componentes || []).map((c) => ({
      articuloUuid: c.articulo?.uuid,
      cantidad: c.cantidad,
      unidadUuid: c.unidad?.uuid || null,
    }));
    // Se costea la receta COMPLETA (existentes + el nuevo) para que
    // costoTotal/costoUnitario de la versión queden consistentes, pero
    // solo se INSERTA la fila nueva — el resto ni se toca.
    const { costoTotal, costoUnitario, detalles } = await calcularCostos([...existentes, payload], rendimiento);
    const nuevo = detalles[detalles.length - 1];

    return sequelize.transaction(async (t) => {
      const componenteCreado = await mezclaRepository.createComponente(
        {
          mezclaVersionId: version.id,
          articuloId: nuevo.articuloId,
          cantidad: nuevo.cantidad,
          unidadId: nuevo.unidadId,
          costoUnitarioSnapshot: nuevo.costoUnitarioSnapshot,
          costoTotalSnapshot: nuevo.costoTotalSnapshot,
        },
        { transaction: t },
      );
      await mezclaRepository.updateVersion(version, { costoTotal, costoUnitario, updatedBy: actorId }, { transaction: t });
      const versionFinal = await getVersionOrFail(versionUuid, { transaction: t });
      return { version: versionFinal, componenteUuid: componenteCreado.uuid };
    });
  },

  // Edita cantidad/unidad de un insumo YA guardado, EN EL LUGAR — mismo
  // motivo que agregarComponente: no puede destruir y recrear la fila
  // porque rompería el componenteId de cualquier etapa que ya la
  // referencie.
  async actualizarComponente(versionUuid, componenteUuid, payload, actorId) {
    const version = await getVersionOrFail(versionUuid);
    assertVersionEditable(version);

    const componente = await mezclaRepository.findComponenteByUuid(componenteUuid);
    if (!componente || componente.mezclaVersionId !== version.id) {
      throw ApiError.notFound('Componente no encontrado en esta prueba');
    }

    const rendimiento = Number(version.mezcla?.rendimiento || 1);
    const listaActualizada = (version.componentes || []).map((c) =>
      c.uuid === componenteUuid
        ? { articuloUuid: c.articulo?.uuid, cantidad: payload.cantidad, unidadUuid: payload.unidadUuid ?? null }
        : { articuloUuid: c.articulo?.uuid, cantidad: c.cantidad, unidadUuid: c.unidad?.uuid || null },
    );
    const { costoTotal, costoUnitario, detalles } = await calcularCostos(listaActualizada, rendimiento);
    const idx = (version.componentes || []).findIndex((c) => c.uuid === componenteUuid);
    const detalle = detalles[idx];

    return sequelize.transaction(async (t) => {
      await mezclaRepository.updateComponente(
        componente,
        {
          cantidad: detalle.cantidad,
          unidadId: detalle.unidadId,
          costoUnitarioSnapshot: detalle.costoUnitarioSnapshot,
          costoTotalSnapshot: detalle.costoTotalSnapshot,
        },
        { transaction: t },
      );
      await mezclaRepository.updateVersion(version, { costoTotal, costoUnitario, updatedBy: actorId }, { transaction: t });
      return getVersionOrFail(versionUuid, { transaction: t });
    });
  },

  // Marca este insumo como el "principal" de la receta — selección única:
  // desmarca cualquier otro que ya lo tuviera. Por ahora es solo un dato
  // guardado (radio de selección única en "Receta actual"); qué lógica lo
  // use se define más adelante.
  async marcarComponentePrincipal(versionUuid, componenteUuid, actorId) {
    const version = await getVersionOrFail(versionUuid);
    assertVersionEditable(version);

    const componente = await mezclaRepository.findComponenteByUuid(componenteUuid);
    if (!componente || componente.mezclaVersionId !== version.id) {
      throw ApiError.notFound('Componente no encontrado en esta prueba');
    }

    return sequelize.transaction(async (t) => {
      for (const c of version.componentes || []) {
        const debeSerPrincipal = c.uuid === componenteUuid;
        if (Boolean(c.esPrincipal) !== debeSerPrincipal) {
          const fila = c.uuid === componenteUuid ? componente : await mezclaRepository.findComponenteByUuid(c.uuid, { transaction: t });
          await mezclaRepository.updateComponente(fila, { esPrincipal: debeSerPrincipal }, { transaction: t });
        }
      }
      await mezclaRepository.updateVersion(version, { updatedBy: actorId }, { transaction: t });
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

    // CORRECCION_PH: el insumo es siempre "Regulador de pH" (se
    // resuelve/crea solo, ver resolveOrCrearReguladorPh) — NO se busca en
    // version.componentes, a propósito no forma parte de la receta
    // permanente.
    let articuloCorreccionId = null;
    let unidadCorreccionId = null;
    if (payload.tipoEtapa === 'CORRECCION_PH') {
      const articuloCorreccion = await resolveOrCrearReguladorPh(actorId);
      articuloCorreccionId = articuloCorreccion.id;
      const unidadCorreccion = await resolveUnidad(payload.unidadCorreccionUuid);
      unidadCorreccionId = unidadCorreccion?.id || null;
    }

    const parametros = await configuracionService.getMezclaParametros();
    const { resultado, cumplePh, cumpleCe } = evaluarResultadoDetalle(payload.ph, payload.ce, parametros);
    const numero = (await mezclaRepository.countEtapas(version.id)) + 1;

    return sequelize.transaction(async (t) => {
      await mezclaRepository.createEtapa(
        {
          mezclaVersionId: version.id,
          numero,
          componenteId,
          tipoEtapa: payload.tipoEtapa || 'MEDICION',
          articuloCorreccionId,
          cantidadCorreccion: payload.tipoEtapa === 'CORRECCION_PH' ? payload.cantidadCorreccion : null,
          unidadCorreccionId,
          ph: payload.ph,
          ce: payload.ce,
          resultado,
          cumplePh,
          cumpleCe,
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

  async subirFotos(versionUuid, archivos, actorId, etapaUuid, homogeneidadUuid) {
    const version = await getVersionOrFail(versionUuid);
    assertVersionEditable(version);

    let mezclaEtapaId = null;
    if (etapaUuid) {
      const etapa = (version.etapas || []).find((e) => e.uuid === etapaUuid);
      if (!etapa) throw ApiError.notFound('Etapa no encontrada en esta prueba');
      mezclaEtapaId = etapa.id;
    }

    let mezclaHomogeneidadId = null;
    if (homogeneidadUuid) {
      const punto = (version.homogeneidad || []).find((h) => h.uuid === homogeneidadUuid);
      if (!punto) throw ApiError.notFound('Punto de control de homogeneidad no encontrado en esta prueba');
      mezclaHomogeneidadId = punto.id;
    }

    const resultado = await cargarFotosMezclaPrueba(
      { documento: version.uuid.slice(0, 8), mezclaNombre: version.mezcla?.nombre || 'mezcla' },
      archivos,
    );

    for (const foto of resultado.fotos) {
      await mezclaRepository.createFoto({
        mezclaVersionId: version.id,
        mezclaEtapaId,
        mezclaHomogeneidadId,
        idDrive: foto.idDrive,
        urlDrive: foto.urlDrive,
        nombreOriginal: foto.nombreOriginal,
        nombreDrive: foto.nombreDrive,
        createdBy: actorId,
      });
    }

    return getVersionOrFail(versionUuid);
  },

  // Prueba de homogeneidad (15/30/60 min): registra o actualiza el punto de
  // control — se llama ANTES de subir la foto correspondiente (ver
  // subirFotos con homogeneidadUuid), mismo patrón de dos pasos que ya usa
  // el frontend para etapas. Un solo registro por (versión, intervalo):
  // volver a registrar el mismo intervalo actualiza el resultado anterior.
  async registrarHomogeneidad(versionUuid, { intervalo, homogenea, observaciones }, actorId) {
    const version = await getVersionOrFail(versionUuid);
    assertVersionEditable(version);

    const existente = await mezclaRepository.findHomogeneidadByVersionEIntervalo(version.id, intervalo);
    if (existente) {
      await mezclaRepository.updateHomogeneidad(existente, {
        homogenea,
        observaciones: observaciones || null,
        medidoEn: new Date(),
        updatedBy: actorId,
      });
    } else {
      await mezclaRepository.createHomogeneidad({
        mezclaVersionId: version.id,
        intervalo,
        homogenea,
        observaciones: observaciones || null,
        medidoEn: new Date(),
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

  // Crea un elaborado SIN pasar por la prueba de laboratorio (pH/CE/etapas)
  // — pedido explícito: hay productos que no necesitan esa validación. Igual
  // se guarda la receta (Mezcla + MezclaComponente), reutilizable después
  // desde Elaboraciones → "Nueva elaboración" para producir más — pero acá
  // NO se descuenta ningún insumo todavía (eso solo pasa cuando de verdad se
  // elabora un lote, no al definir qué lleva la receta).
  //
  // Si lo crea un Administrador, la receta queda lista de una (CONVERTIDA,
  // artículo activo) — no necesita aprobación. Cualquier otro rol la deja
  // PENDIENTE_APROBACION, igual que el flujo con prueba; aprobar() detecta
  // que no hay `elaboradoPayload` (esta receta nunca produjo un lote) y solo
  // activa el artículo, sin tocar stock.
  async crearDirecta(payload, actorId, user) {
    const almacen = await resolveAlmacen(payload.almacenUuid);
    if (!almacen) throw ApiError.badRequest('Indica el almacén de la receta');

    const categoria = await ArticuloCategoria.findOne({ where: { uuid: payload.articuloCategoriaUuid } });
    if (!categoria) throw ApiError.notFound('Categoría no encontrada');
    if (categoria.tipo !== 'ELABORADO') {
      throw ApiError.badRequest('La categoría del artículo elaborado debe ser de tipo Elaborado');
    }

    const rendimiento = Number(payload.rendimiento);
    const componentes = payload.componentes || [];
    if (!componentes.length) throw ApiError.badRequest('Agrega al menos un insumo a la receta');
    const { costoTotal, costoUnitario, detalles } = await calcularCostos(componentes, rendimiento);

    const esAdmin = (user?.roles || []).includes('Administrador');

    // articuloService.create() maneja su propia transacción interna (mismo
    // patrón ya usado en crearElaborado()) — se llama antes de abrir la de
    // acá abajo.
    const nuevoArticulo = await articuloService.create(
      {
        nombre: payload.articuloNombre,
        codigo: payload.articuloCodigo || null,
        categoriaUuid: payload.articuloCategoriaUuid,
        unidadMedidaUuid: payload.articuloUnidadMedidaUuid || null,
        costoCompra: 0,
        precioVenta: 0,
        // Administrador: activo de una. Cualquier otro rol: inactivo hasta
        // que se apruebe (mismo criterio que crearElaborado()).
        estado: esAdmin,
      },
      actorId,
    );

    return sequelize.transaction(async (t) => {
      if (payload.articuloNombre) {
        await assertSinDuplicado(Mezcla, { nombre: payload.articuloNombre }, t, 'Ya existe una mezcla con ese nombre');
      }
      const codigo = await generarCorrelativo(Mezcla, { prefijo: 'MEZ', columna: 'codigo', padding: 4, transaction: t });

      const mezcla = await mezclaRepository.create(
        {
          codigo,
          nombre: payload.articuloNombre,
          articuloElaboradoId: nuevoArticulo.id,
          unidadRendimientoId: nuevoArticulo.unidadMedidaId || null,
          rendimiento,
          dosisPorHectarea: payload.dosisPorHectarea ?? null,
          estado: true,
          createdBy: actorId,
        },
        { transaction: t },
      );

      const ahora = new Date();
      const version = await MezclaVersion.create(
        {
          mezclaId: mezcla.id,
          version: 1,
          activa: true,
          costoTotal,
          costoUnitario,
          estadoPrueba: esAdmin ? 'CONVERTIDA' : 'PENDIENTE_APROBACION',
          almacenId: almacen.id,
          finalizadaEn: ahora,
          finalizadaPorId: actorId,
          ...(esAdmin ? { aprobadaEn: ahora, aprobadaPorId: actorId } : {}),
          createdBy: actorId,
          esDirecta: true,
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

      const versionFinal = await getVersionOrFail(version.uuid, { transaction: t });
      return { version: versionFinal };
    });
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

    // Quien inicia la prueba (createdBy) es quien debe finalizarla — evita
    // que otro usuario cierre una prueba que no siguió de principio a fin
    // (pedido explícito: iniciado y finalizado deben ser la misma persona).
    if (version.createdBy && actorId && version.createdBy !== actorId) {
      throw ApiError.forbidden('Solo el usuario que inició esta prueba puede finalizarla');
    }

    if (!version.componentes?.length) throw ApiError.badRequest('La prueba no tiene componentes registrados');
    if (!version.etapas?.length) throw ApiError.badRequest('La prueba no tiene ninguna etapa de medición registrada');
    if (!version.almacenId) throw ApiError.badRequest('La prueba no tiene almacén de origen — no se puede descontar inventario');
    // El nombre es opcional al crear la prueba (se asigna más adelante),
    // pero ya no puede faltar al cerrarla: la prueba finalizada queda fija
    // en el historial/trazabilidad. El artículo elaborado NO se exige
    // acá — todavía no existe: nace en crearElaborado() a partir de la
    // prueba ya finalizada y ÓPTIMA.
    if (!version.mezcla?.nombre) throw ApiError.badRequest('Asigna un nombre a la prueba antes de finalizarla');

    const parametros = await configuracionService.getMezclaParametros();
    const motivo = await Motivo.findOne({ where: { codigo: MOTIVO_PRUEBA_MEZCLA_CODIGO } });

    try {
      return await sequelize.transaction(async (t) => {
        // Re-chequeo dentro de la transacción — evita doble descuento si dos
        // requests llegan casi al mismo tiempo (el mismo criterio que
        // assertStockSuficiente usa lock de fila, acá el propio estado de la
        // versión hace de guardia).
        const fresh = await MezclaVersion.findByPk(version.id, { transaction: t, lock: t.LOCK.UPDATE });
        if (!ESTADOS_EDITABLES.includes(fresh.estadoPrueba)) {
          throw ApiError.conflict('Esta prueba ya fue finalizada');
        }

        // Se relee la versión completa (componentes/etapas) YA bajo el lock
        // recién adquirido — la copia `version` de arriba (leída antes de
        // la transacción) pudo quedar desactualizada si alguien editó la
        // receta entre el GET inicial y este momento; finalizar() siempre
        // debe descontar stock según el último estado confirmado.
        const versionLock = await getVersionOrFail(versionUuid, { transaction: t });

        // Si algún punto de control YA falló, la prueba se da por terminada
        // ahí mismo — no hace falta (ni tiene sentido) seguir registrando
        // los checkpoints restantes (pedido explícito: "si falló en una de
        // sus etapas debería dejarla finalizar", coherente con el bloqueo
        // que ya existe en el frontend impidiendo continuar tras un fallo).
        // Solo si NINGUNO falló se exigen los 3 (15/30/60 min) registrados
        // — recién ahí queda garantizado que se completó el seguimiento
        // completo antes de dar la prueba por ÓPTIMA.
        const yaFallo = versionLock.homogeneidad?.some((h) => h.homogenea === false);
        if (!yaFallo) {
          const checkpointsFaltantes = INTERVALOS_HOMOGENEIDAD.filter(
            (codigo) => !versionLock.homogeneidad?.some((h) => h.intervalo === codigo),
          );
          if (checkpointsFaltantes.length > 0) {
            throw ApiError.badRequest('Registra los 3 puntos de control de la prueba de homogeneidad (15, 30 y 60 minutos) antes de finalizar');
          }
        }

        const ultimaEtapa = versionLock.etapas[versionLock.etapas.length - 1];
        const resultadoFinal = evaluarResultado(ultimaEtapa.ph, ultimaEtapa.ce, parametros);
        // Aunque el pH/CE final haya dado dentro de rango, un punto de
        // control de homogeneidad fallido invalida la prueba igual (pedido
        // explícito: "no puede quedar como ÓPTIMA porque falló en la etapa
        // de homogeneidad") — la mezcla se separó, así que no sirve aunque
        // el químico final haya cumplido.
        const estadoPrueba = resultadoFinal === 'CUMPLE' && !yaFallo ? 'OPTIMA' : 'NO_VALIDA';

        const documento = await generarCorrelativo(MezclaVersion, { prefijo: 'MIX', columna: 'movimientoDocumento', padding: 4, transaction: t });

        // Cada componente puede ser un insumo real o, a su vez, OTRO
        // elaborado (pedido explícito: los elaborados nunca tienen saldo
        // propio — al usarse se descuenta su receta, no una fila de stock
        // propia). Se recorre con consumirStockConReceta, que resuelve eso
        // recursivamente; acá solo se crea el MovimientoInventario 'SALIDA'
        // por cada insumo real efectivamente descontado.
        const advertencias = [];
        for (const comp of versionLock.componentes) {
          const cantidadBase = await convertirACantidadBase(comp.articulo, comp.unidadId, comp.cantidad, { transaction: t });
          await consumirStockConReceta(versionLock.almacenId, comp.articulo, cantidadBase, {
            transaction: t,
            // Siempre se fuerza acá adentro — se junta TODA advertencia de
            // la receta en una sola pasada; recién abajo se decide si hacía
            // falta forzar de verdad.
            forzarSaldoNegativo: true,
            advertencias,
            onLeafConsumido: async (leafArticulo, leafCantidadBase) => {
              const costoUnit = Number(leafArticulo.costoCompra || 0);
              await MovimientoInventario.create(
                {
                  documento,
                  tipo: 'SALIDA',
                  fecha: new Date().toISOString().slice(0, 10),
                  almacenId: versionLock.almacenId,
                  articuloId: leafArticulo.id,
                  // Se guarda en la unidad BASE del artículo — pedido
                  // explícito: aunque se haya medido en otra unidad, el
                  // listado de Movimientos debe reflejar la unidad por
                  // defecto del artículo.
                  cantidad: leafCantidadBase,
                  cantidadBase: leafCantidadBase,
                  unidadId: leafArticulo.unidadMedidaId || null,
                  costoUnitario: costoUnit,
                  costoTotal: costoUnit * leafCantidadBase,
                  motivoId: motivo?.id || null,
                  observaciones: `Prueba de mezcla ${versionLock.mezcla?.nombre || ''} — ${documento}`,
                  usuarioId: actorId,
                },
                { transaction: t },
              );
            },
          });
        }

        // Correcciones de pH (ej. regulador de pH) registradas en las
        // propias etapas — se descuentan una única vez acá, con el mismo
        // documento MIX-xxxx, pero NUNCA se agregan a mezcla_componentes:
        // no deben quedar en la receta permanente del elaborado (pedido
        // explícito).
        const etapasCorreccion = (versionLock.etapas || []).filter((et) => et.tipoEtapa === 'CORRECCION_PH');
        for (const et of etapasCorreccion) {
          const cantidadBase = await convertirACantidadBase(
            et.articuloCorreccion,
            et.unidadCorreccionId,
            et.cantidadCorreccion,
            { transaction: t },
          );
          await consumirStockConReceta(versionLock.almacenId, et.articuloCorreccion, cantidadBase, {
            transaction: t,
            forzarSaldoNegativo: true,
            advertencias,
            onLeafConsumido: async (leafArticulo, leafCantidadBase) => {
              const costoUnit = Number(leafArticulo.costoCompra || 0);
              await MovimientoInventario.create(
                {
                  documento,
                  tipo: 'SALIDA',
                  fecha: new Date().toISOString().slice(0, 10),
                  almacenId: versionLock.almacenId,
                  articuloId: leafArticulo.id,
                  cantidad: leafCantidadBase,
                  cantidadBase: leafCantidadBase,
                  unidadId: leafArticulo.unidadMedidaId || null,
                  costoUnitario: costoUnit,
                  costoTotal: costoUnit * leafCantidadBase,
                  motivoId: motivo?.id || null,
                  observaciones: `Corrección de pH — prueba ${versionLock.mezcla?.nombre || ''} — ${documento}`,
                  usuarioId: actorId,
                },
                { transaction: t },
              );
            },
          });
        }

        if (advertencias.length > 0 && !forzarSaldoNegativo) {
          // Se lanza para que la transacción haga ROLLBACK — no quedó nada
          // escrito, ni los movimientos ni los deltas de existencia ya
          // aplicados en esta misma pasada.
          throw new RequiereConfirmacionStockError(advertencias);
        }

        await mezclaRepository.updateVersion(
          fresh,
          {
            estadoPrueba,
            phFinal: ultimaEtapa.ph,
            ceFinal: ultimaEtapa.ce,
            parametrosUsados: parametros,
            movimientoDocumento: documento,
            finalizadaEn: new Date(),
            finalizadaPorId: actorId,
            updatedBy: actorId,
          },
          { transaction: t },
        );

        const versionFinal = await getVersionOrFail(versionUuid, { transaction: t });
        return { requiereConfirmacion: false, advertencias: [], version: versionFinal };
      });
    } catch (err) {
      if (err instanceof RequiereConfirmacionStockError) {
        return { requiereConfirmacion: true, advertencias: err.advertencias, version: null };
      }
      throw err;
    }
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
          // Nace INACTIVO: no se puede usar en movimientos/elaboraciones/
          // proformas hasta que un aprobador autorizado apruebe la prueba
          // (ver aprobar() más abajo), que es cuando se activa.
          estado: false,
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

    // NO se genera todavía la Elaboración ni su entrada de inventario: eso
    // recién ocurre al APROBAR (ver aprobar()). Acá solo se guardan los
    // datos que el operador ingresó, para reusarlos en ese momento — así el
    // elaborado NO entra al inventario hasta que un aprobador lo valide.
    await mezclaRepository.updateVersion(version, {
      estadoPrueba: 'PENDIENTE_APROBACION',
      elaboradoPayload: {
        cantidadElaborada: payload.cantidadElaborada,
        almacenUuid: payload.almacenUuid,
        fecha: payload.fecha,
        observaciones: payload.observaciones ?? null,
        forzarSaldoNegativo: payload.forzarSaldoNegativo === true,
      },
      updatedBy: actorId,
    });

    const versionFinal = await getVersionOrFail(versionUuid);
    return { requiereConfirmacion: false, advertencias: [], version: versionFinal };
  },

  // Aprobación de la prueba pendiente: solo un usuario cuyo rol esté en la
  // lista configurada (Configuración → Parámetros de Mezcla) o un
  // Administrador. RECIÉN ACÁ se genera la Elaboración y su entrada de
  // inventario del artículo elaborado (con los datos guardados en
  // crearElaborado()), la prueba pasa a CONVERTIDA, se registra fecha/hora
  // + usuario, y el artículo elaborado se ACTIVA para poder usarse.
  async aprobar(versionUuid, actorId, user, { forzarSaldoNegativo = false } = {}) {
    const version = await getVersionOrFail(versionUuid);
    if (version.estadoPrueba !== 'PENDIENTE_APROBACION') {
      throw ApiError.badRequest('Esta prueba no está pendiente de aprobación');
    }

    const esAdmin = (user?.roles || []).includes('Administrador');
    if (!esAdmin) {
      const { aprobadoresRolesUuids = [] } = await configuracionService.getMezclaParametros();
      const rolesUsuario = await mezclaRepository.findRolUuidsByUserId(actorId);
      const autorizado = aprobadoresRolesUuids.length > 0 && rolesUsuario.some((r) => aprobadoresRolesUuids.includes(r));
      if (!autorizado) {
        throw ApiError.forbidden('Tu rol no está autorizado para aprobar pruebas de mezcla');
      }
    }

    // Todo el aprobar queda en UNA sola transacción con lock — el lock se
    // toma primero (antes de crear la Elaboración), así dos aprobaciones
    // casi simultáneas de la misma prueba nunca pueden crear dos
    // Elaboraciones/movimientos duplicados: la segunda espera el lock, lo
    // obtiene después de que la primera ya cambió el estado a CONVERTIDA, y
    // falla en el chequeo de estado sin haber tocado inventario.
    try {
      return await sequelize.transaction(async (t) => {
        const fresh = await MezclaVersion.findByPk(version.id, { transaction: t, lock: t.LOCK.UPDATE });
        if (fresh.estadoPrueba !== 'PENDIENTE_APROBACION') {
          throw ApiError.conflict('Esta prueba ya fue aprobada');
        }

        // Una receta creada directa (crearDirecta(), sin prueba de
        // laboratorio) nunca guarda elaboradoPayload — nunca produjo un
        // lote, así que aprobar acá solo activa el artículo, sin tocar
        // stock (pedido explícito: crear/aprobar la receta no debe
        // descontar insumos).
        let elaboracionId = null;
        if (version.elaboradoPayload) {
          const pl = version.elaboradoPayload;
          const resultado = await elaboracionService.create(
            {
              mezclaVersionUuid: version.uuid,
              cantidadElaborada: pl.cantidadElaborada,
              almacenUuid: pl.almacenUuid,
              // La fecha del elaborado es la de APROBACIÓN, no la que se
              // envió al usar "Crear elaborado" (ahí solo se guardan los
              // datos en espera — el elaborado de verdad, con su entrada de
              // inventario, nace acá).
              fecha: new Date().toISOString().slice(0, 10),
              observaciones: pl.observaciones,
            },
            actorId,
            // omitirSalidaComponentes: los insumos ya se descontaron al
            // finalizar la prueba — esta conversión solo deja el
            // registro/costeo de la Elaboración (el elaborado en sí nunca
            // tiene saldo propio, ver elaboracion.service.js#create).
            // transaction: t — comparte el lock ya tomado arriba, todo
            // queda en un único commit/rollback.
            { forzarSaldoNegativo: forzarSaldoNegativo || pl.forzarSaldoNegativo === true, omitirSalidaComponentes: true, transaction: t },
          );
          if (resultado.requiereConfirmacion) {
            // No se puede "return" un requiereConfirmacion normal acá: el
            // callback de sequelize.transaction espera que devolver == commit.
            // Se lanza un marcador para forzar el ROLLBACK y se traduce
            // afuera del try/catch, igual que finalizar()/crearElaborado().
            throw new RequiereConfirmacionStockError(resultado.advertencias);
          }
          elaboracionId = resultado.elaboracion.id;
        }

        await mezclaRepository.updateVersion(
          fresh,
          {
            estadoPrueba: 'CONVERTIDA',
            ...(elaboracionId ? { elaboracionId } : {}),
            aprobadaEn: new Date(),
            aprobadaPorId: actorId,
            updatedBy: actorId,
          },
          { transaction: t },
        );
        const articuloElaboradoId = version.mezcla?.articuloElaboradoId;
        if (articuloElaboradoId) {
          await Articulo.update({ estado: true, updatedBy: actorId }, { where: { id: articuloElaboradoId }, transaction: t });

          // Si el operador nunca cargó un "Volumen por hectárea" a mano
          // para esta mezcla, se le pone un default acá (pedido explícito)
          // — 6 galones/ha convertidos a Litros, nunca en Galones. Si ya
          // tiene uno cargado, no se pisa.
          if (version.mezcla && (version.mezcla.dosisPorHectarea === null || version.mezcla.dosisPorHectarea === undefined)) {
            const [galon, litro] = await Promise.all([
              UnidadMedida.findOne({ where: { nombre: 'Galón' }, transaction: t }),
              UnidadMedida.findOne({ where: { nombre: 'Litro' }, transaction: t }),
            ]);
            if (galon && litro) {
              const factor = await resolverFactorConversion(galon.id, litro.id, { transaction: t });
              if (factor !== null) {
                await Mezcla.update(
                  {
                    dosisPorHectarea: DOSIS_POR_HECTAREA_DEFAULT_GALONES * factor,
                    dosisPorHectareaUnidadId: litro.id,
                    updatedBy: actorId,
                  },
                  { where: { id: version.mezcla.id }, transaction: t },
                );
              }
            }
          }
        }

        return { requiereConfirmacion: false, advertencias: [], version: await getVersionOrFail(versionUuid, { transaction: t }) };
      });
    } catch (err) {
      if (err instanceof RequiereConfirmacionStockError) {
        return { requiereConfirmacion: true, advertencias: err.advertencias, version: null };
      }
      throw err;
    }
  },
};

export default mezclaService;
