import { Op } from 'sequelize';
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
import {
  normalizarReglaDosisRelativa,
  validarReglasDosisRelativa,
  resolverCantidadesRelativas,
  propagarDosisRelativas,
} from '../../utils/dosisRelativa.js';
import { generarCorrelativo } from '../../utils/correlativo.js';
import { assertAlmacenPermitido } from '../../utils/almacenScope.js';
import { cargarFotosMezclaPrueba, eliminarFotoDeDrive, descargarArchivoDeDrive } from '../googleDrive/cargueFotosLabor.js';
import { parseBulkFile } from '../../utils/bulkFileParser.js';

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

const REGULADOR_PH_NOMBRE = 'ACONDICIONADOR';
const REGULADOR_PH_CATEGORIA = 'Insumo Corbana';
const REGULADOR_PH_UNIDAD_CODIGO = 'Kg';

// El insumo de corrección de pH es siempre "ACONDICIONADOR" (pedido
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

// Total de referencia para estimar renglones POR_VOLUMEN al guardar la
// receta ({ cantidad, unidadId } — ej. rendimiento con su unidad). Null si
// no hay con qué (se conserva la cantidad del payload). Acepta uuid o id
// de unidad.
async function totalRefReceta(rendimiento, { unidadUuid = null, unidadId = null } = {}, { transaction } = {}) {
  const rend = Number(rendimiento);
  if (!(rend > 0)) return null;
  let id = unidadId;
  if (!id && unidadUuid) {
    const u = await UnidadMedida.findOne({ where: { uuid: unidadUuid }, transaction });
    id = u?.id || null;
  }
  if (!id) return null;
  return { cantidad: rend, unidadId: id };
}

async function calcularCostos(componentesPayload, rendimiento, { totalRef = null } = {}) {
  // Dosis relativa primero: los seguidores se costean con su cantidad ya
  // resuelta (X% de la referencia o tasa × total de referencia), no con
  // lo que traiga el payload.
  const conRegla = componentesPayload.map((comp) => ({ ...comp, ...normalizarReglaDosisRelativa(comp) }));
  const { filas: validadas, refDe } = await validarReglasDosisRelativa(conRegla);
  const resueltas = await resolverCantidadesRelativas({ filas: validadas, refDe }, { totalRef });
  // Dosis de referencia por renglón (manda sobre la del artículo): ambas o
  // ninguna; se resuelve la unidad a id acá para persistirla abajo.
  for (const comp of resueltas) {
    const d = comp.dosisPorHectarea ?? null;
    const u = comp.dosisUnidadUuid || null;
    const hayDosis = d !== null && d !== '' && Number(d) > 0;
    if (hayDosis !== Boolean(u)) {
      throw ApiError.badRequest('La dosis del renglón exige valor Y unidad juntos');
    }
    comp.dosisPorHectarea = hayDosis ? Number(d) : null;
    comp.dosisUnidadId = null;
    if (hayDosis) {
      const unidad = await resolveUnidad(u);
      comp.dosisUnidadId = unidad.id;
    }
  }
  let costoTotal = 0;
  const detalles = [];
  for (const comp of resueltas) {
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
      esPrincipal: Boolean(comp.esPrincipal),
      tipoDosis: comp.tipoDosis || 'FIJA',
      referenciaArticuloId: comp.referenciaArticuloId ?? null,
      porcentajeReferencia: comp.porcentajeReferencia ?? null,
      tasa: comp.tasa ?? null,
      tasaUnidadId: comp.tasaUnidadId ?? null,
      dosisPorHectarea: comp.dosisPorHectarea ?? null,
      dosisUnidadId: comp.dosisUnidadId ?? null,
    });
  }
  const costoUnitario = rendimiento ? costoTotal / Number(rendimiento) : costoTotal;
  return { costoTotal, costoUnitario, detalles };
}

// pH mínimo <= pH <= pH máximo, y CE < CE máxima — nunca hardcodeado, ver
// configuracion.service.js#getMezclaParametros.
// Devuelve el resultado global MÁS el detalle de qué condición falló — el
// pH se puede corregir con el ACONDICIONADOR, la CE no tiene forma de
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

// Traduce una fila guardada a forma de payload (para validar/costear junto
// a filas nuevas) — incluye la regla de dosis si la tiene, para que
// validarReglasDosisRelativa vea la receta completa (ciclos incluidos).
async function filaGuardadaAEdicion(c, transaction) {
  let referenciaArticuloUuid = null;
  if (c.referenciaArticuloId) {
    const refArt = await Articulo.findByPk(c.referenciaArticuloId, { transaction });
    referenciaArticuloUuid = refArt?.uuid || null;
  }
  let tasaUnidadUuid = null;
  if (c.tasaUnidadId) {
    const tasaUnidad = await UnidadMedida.findByPk(c.tasaUnidadId, { transaction });
    tasaUnidadUuid = tasaUnidad?.uuid || null;
  }
  let dosisUnidadUuid = null;
  if (c.dosisUnidadId) {
    const dosisUnidad = await UnidadMedida.findByPk(c.dosisUnidadId, { transaction });
    dosisUnidadUuid = dosisUnidad?.uuid || null;
  }
  return {
    uuid: c.uuid,
    articuloUuid: c.articulo?.uuid,
    cantidad: c.cantidad,
    unidadUuid: c.unidad?.uuid || null,
    tipoDosis: c.tipoDosis || (c.referenciaArticuloId ? 'PORCENTAJE' : 'FIJA'),
    referenciaArticuloUuid,
    porcentajeReferencia: c.porcentajeReferencia === null || c.porcentajeReferencia === undefined ? null : Number(c.porcentajeReferencia),
    tasa: c.tasa === null || c.tasa === undefined ? null : Number(c.tasa),
    tasaUnidadUuid,
    dosisPorHectarea: c.dosisPorHectarea === null || c.dosisPorHectarea === undefined ? null : Number(c.dosisPorHectarea),
    dosisUnidadUuid,
  };
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
      insumoUuid: query.insumoUuid,
      ingredienteActivoUuid: query.ingredienteActivoUuid,
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
  async create(payload, actorId, user) {
    const unidad = await resolveUnidad(payload.unidadRendimientoUuid);
    const almacen = await resolveAlmacen(payload.almacenUuid);
    assertAlmacenPermitido(user, almacen.id);

    const rendimiento = Number(payload.rendimiento || 1);
    const componentes = payload.componentes || [];
    const totalRef = await totalRefReceta(rendimiento, { unidadUuid: payload.unidadRendimientoUuid });
    const { costoTotal, costoUnitario, detalles } = await calcularCostos(componentes, rendimiento, { totalRef });

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
          // Si el cliente mandó un uuid propio (app móvil offline, ver
          // mezcla.validator.js#createMezclaSchema), se usa ese — si no,
          // Sequelize genera uno (defaultValue: UUIDV4) como siempre.
          uuid: payload.uuid,
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
          // Mismo uuid que la Mezcla (no por compartir identidad, sino
          // para que el cliente offline solo tenga que generar/recordar
          // un uuid por prueba en vez de dos) — ver createMezclaSchema.
          uuid: payload.uuid,
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
            esPrincipal: det.esPrincipal,
            tipoDosis: det.tipoDosis || 'FIJA',
            referenciaArticuloId: det.referenciaArticuloId ?? null,
            porcentajeReferencia: det.porcentajeReferencia ?? null,
            tasa: det.tasa ?? null,
            tasaUnidadId: det.tasaUnidadId ?? null,
            dosisPorHectarea: det.dosisPorHectarea ?? null,
            dosisUnidadId: det.dosisUnidadId ?? null,
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
            // La regla de dosis relativa sobrevive a la clonación (si no,
            // cambiar solo el rendimiento la borraría en silencio).
            let referenciaArticuloUuid = null;
            if (c.referenciaArticuloId) {
              const refArt = await Articulo.findByPk(c.referenciaArticuloId, { transaction: t });
              referenciaArticuloUuid = refArt?.uuid || null;
            }
            // Igual la dosis del renglón y la unidad de la tasa.
            let dosisUnidadUuid = null;
            if (c.dosisUnidadId) {
              const dosisUni = await UnidadMedida.findByPk(c.dosisUnidadId, { transaction: t });
              dosisUnidadUuid = dosisUni?.uuid || null;
            }
            let tasaUnidadUuid = null;
            if (c.tasaUnidadId) {
              const tasaUni = await UnidadMedida.findByPk(c.tasaUnidadId, { transaction: t });
              tasaUnidadUuid = tasaUni?.uuid || null;
            }
            return {
              articuloUuid: prod.uuid,
              cantidad: Number(c.cantidad),
              unidadUuid,
              tipoDosis: c.tipoDosis || (c.referenciaArticuloId ? 'PORCENTAJE' : 'FIJA'),
              referenciaArticuloUuid,
              porcentajeReferencia:
                c.porcentajeReferencia === null || c.porcentajeReferencia === undefined ? null : Number(c.porcentajeReferencia),
              tasa: c.tasa === null || c.tasa === undefined ? null : Number(c.tasa),
              tasaUnidadUuid,
              dosisPorHectarea:
                c.dosisPorHectarea === null || c.dosisPorHectarea === undefined ? null : Number(c.dosisPorHectarea),
              dosisUnidadUuid,
            };
          }),
        );
        if (payload.rendimiento !== undefined) rendimientoNuevo = Number(payload.rendimiento);
      } else {
        throw ApiError.badRequest('No hay versión activa previa para clonar componentes');
      }

      const { costoTotal, costoUnitario, detalles } = await calcularCostos(componentesPayload, rendimientoNuevo, {
        totalRef: await totalRefReceta(rendimientoNuevo, {
          unidadUuid: payload.unidadRendimientoUuid,
          unidadId: mezcla.unidadRendimientoId,
        }),
      });

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
            esPrincipal: det.esPrincipal,
            tipoDosis: det.tipoDosis || 'FIJA',
            referenciaArticuloId: det.referenciaArticuloId ?? null,
            porcentajeReferencia: det.porcentajeReferencia ?? null,
            tasa: det.tasa ?? null,
            tasaUnidadId: det.tasaUnidadId ?? null,
            dosisPorHectarea: det.dosisPorHectarea ?? null,
            dosisUnidadId: det.dosisUnidadId ?? null,
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

  // Papelera: solo mezclas eliminadas lógicamente. Acceso restringido al
  // rol Administrador desde la ruta (requireAdmin).
  async listDeleted(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await mezclaRepository.findAndCountAllDeleted({
      limit,
      offset,
      search: query.search,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  // Acceso restringido al rol Administrador desde la ruta (requireAdmin).
  async restore(uuid) {
    const mezcla = await mezclaRepository.findByUuidIncludingDeleted(uuid);
    if (!mezcla) throw ApiError.notFound('Mezcla no encontrada');
    if (!mezcla.deletedAt) throw ApiError.conflict('La mezcla no está eliminada');
    await mezclaRepository.restore(mezcla);
    return mezcla;
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
    const totalRefVersion = await totalRefReceta(rendimiento, { unidadUuid: version.mezcla?.unidadRendimiento?.uuid });
    const { costoTotal, costoUnitario, detalles } = await calcularCostos(componentes, rendimiento, { totalRef: totalRefVersion });

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
            tipoDosis: det.tipoDosis || 'FIJA',
            referenciaArticuloId: det.referenciaArticuloId ?? null,
            porcentajeReferencia: det.porcentajeReferencia ?? null,
            tasa: det.tasa ?? null,
            tasaUnidadId: det.tasaUnidadId ?? null,
            dosisPorHectarea: det.dosisPorHectarea ?? null,
            dosisUnidadId: det.dosisUnidadId ?? null,
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
    const existentes = [];
    for (const c of version.componentes || []) {
      existentes.push(await filaGuardadaAEdicion(c));
    }
    // Se costea la receta COMPLETA (existentes + el nuevo) para que
    // costoTotal/costoUnitario de la versión queden consistentes, pero
    // solo se INSERTA la fila nueva — el resto ni se toca.
    const { costoTotal, costoUnitario, detalles } = await calcularCostos([...existentes, payload], rendimiento, {
      totalRef: await totalRefReceta(rendimiento, { unidadUuid: version.mezcla?.unidadRendimiento?.uuid }),
    });
    const nuevo = detalles[detalles.length - 1];

    return sequelize.transaction(async (t) => {
      const componenteCreado = await mezclaRepository.createComponente(
        {
          uuid: payload.uuid,
          mezclaVersionId: version.id,
          articuloId: nuevo.articuloId,
          cantidad: nuevo.cantidad,
          unidadId: nuevo.unidadId,
          costoUnitarioSnapshot: nuevo.costoUnitarioSnapshot,
          costoTotalSnapshot: nuevo.costoTotalSnapshot,
          tipoDosis: nuevo.tipoDosis || 'FIJA',
          referenciaArticuloId: nuevo.referenciaArticuloId ?? null,
          porcentajeReferencia: nuevo.porcentajeReferencia ?? null,
          tasa: nuevo.tasa ?? null,
          tasaUnidadId: nuevo.tasaUnidadId ?? null,
          dosisPorHectarea: nuevo.dosisPorHectarea ?? null,
          dosisUnidadId: nuevo.dosisUnidadId ?? null,
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
    const listaActualizada = [];
    for (const c of version.componentes || []) {
      const base = await filaGuardadaAEdicion(c);
      listaActualizada.push(
        c.uuid === componenteUuid
          ? { ...base, cantidad: payload.cantidad, unidadUuid: payload.unidadUuid ?? null }
          : base,
      );
    }
    const { costoTotal, costoUnitario, detalles } = await calcularCostos(listaActualizada, rendimiento, {
      totalRef: await totalRefReceta(rendimiento, { unidadUuid: version.mezcla?.unidadRendimiento?.uuid }),
    });
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
      // Si el renglón editado es referencia de una dosis relativa, los
      // seguidores se recalculan y persisten (la lista ya se validó y
      // costeó con los valores nuevos, así que los totales no cambian).
      await propagarDosisRelativas(version.id, { transaction: t });
      await mezclaRepository.updateVersion(version, { costoTotal, costoUnitario, updatedBy: actorId }, { transaction: t });
      return getVersionOrFail(versionUuid, { transaction: t });
    });
  },

  // Lleva la receta a 1 LITRO con las DOSIS EXACTAS — se llama sola al abrir
  // por primera vez un borrador creado con "Nueva mezcla" (cuyas cantidades
  // son de un lote de varios litros) y deja la receta lista para medir:
  //  - Cada insumo con dosis por hectárea queda en la cantidad EXACTA de esa
  //    dosis para 1 litro de mezcla (6 galones/ha = 22,71 L/ha), en la unidad
  //    más pequeña compatible (ml, g) porque la columna guarda 2 decimales.
  //  - Los insumos sin dosis se escalan proporcionalmente (÷ lo que suma hoy).
  //  - Las dosis relativas (ej. HIPOTENSOR = 1% del ACEITE) se recalculan
  //    desde su referencia.
  //  - El Agua completa exactamente 1 litro.
  //  - El rendimiento de la mezcla pasa a 1 litro (la receta ahora es de 1 L),
  //    así Aspersiones calcula cada insumo con la dosis exacta por hectárea.
  // Idempotente: si ya se normalizó, devuelve la versión tal cual.
  async llevarAUnLitro(versionUuid, actorId) {
    const version = await getVersionOrFail(versionUuid);
    assertVersionEditable(version);
    if (version.recetaNormalizada) return version;
    if (!version.activa) throw ApiError.badRequest('Solo se puede llevar a 1 litro la versión activa de la mezcla');
    const componentes = version.componentes || [];
    if (!componentes.length) throw ApiError.badRequest('La receta no tiene insumos');

    const todasUnidades = await UnidadMedida.findAll();
    const litro = todasUnidades.find((u) => u.nombre === 'Litro');
    const galon = todasUnidades.find((u) => u.nombre === 'Galón');
    if (!litro || !galon) throw ApiError.badRequest('Faltan las unidades "Litro" y/o "Galón" en el catálogo de unidades');
    const porUuid = new Map(todasUnidades.map((u) => [u.uuid, u]));

    const factorA = async (origenId, destinoId, nombre) => {
      const f = await resolverFactorConversion(origenId, destinoId);
      if (f === null) throw ApiError.badRequest(`No hay conversión de unidades para "${nombre}" — agrégala en Unidades de Medida`);
      return f;
    };
    // Litros por hectárea del rendimiento por defecto de una mezcla (6 gal/ha).
    const litrosPorHa = (await factorA(galon.id, litro.id, 'Galón')) * 6;

    const cacheMasPequena = new Map();
    const masPequenaDe = async (unidadId) => {
      if (cacheMasPequena.has(unidadId)) return cacheMasPequena.get(unidadId);
      let mejor = { id: unidadId, tamano: 1 };
      for (const u of todasUnidades) {
        const tamano = await resolverFactorConversion(u.id, unidadId);
        if (tamano !== null && tamano > 0 && tamano < mejor.tamano) mejor = { id: u.id, tamano };
      }
      cacheMasPequena.set(unidadId, mejor.id);
      return mejor.id;
    };
    // Los insumos que NO se pueden expresar en litros (ej. ACONDICIONADOR en
    // Kg) no suman al volumen, pero sí se escalan igual que los demás.
    const litrosDe = async (unidadId, cantidad) => {
      const f = await resolverFactorConversion(unidadId, litro.id);
      return f === null ? 0 : cantidad * f;
    };

    let totalLitros = 0;
    for (const c of componentes) {
      if (!c.unidadId) throw ApiError.badRequest(`"${c.articulo?.nombre || 'un insumo'}" no tiene unidad`);
      totalLitros += await litrosDe(c.unidadId, Number(c.cantidad));
    }
    const factorEscala = totalLitros > 0 ? 1 / totalLitros : 1;

    const esAgua = (c) => c.articulo?.nombre === 'Agua';
    const nuevos = new Map(); // uuid -> { cantidad, unidadId }
    for (const c of componentes) {
      if (esAgua(c)) continue;
      const nombre = c.articulo?.nombre || 'un insumo';
      const art = c.articulo;
      // Unidad más fina a partir de la unidad base del artículo (como al
      // agregar un insumo en la prueba); si no tiene, la de la receta.
      const unidadNuevaId = await masPequenaDe(art?.unidadMedidaId || c.unidadId);
      const dosisUnidad = art?.dosisUnidad?.uuid ? porUuid.get(art.dosisUnidad.uuid) : null;
      // La dosis del renglón manda sobre la del artículo (ej. ACEITE a
      // 2.0/ha en una mezcla y 1.5/ha en la mayoría).
      const dosisRowUnidad = c.dosisUnidadId ? todasUnidades.find((u) => u.id === c.dosisUnidadId) || null : null;
      const dosisRef =
        c.dosisPorHectarea !== null && c.dosisPorHectarea !== undefined && dosisRowUnidad
          ? { valor: Number(c.dosisPorHectarea), unidad: dosisRowUnidad }
          : art?.dosisPorHectarea !== null && art?.dosisPorHectarea !== undefined && dosisUnidad
            ? { valor: Number(art.dosisPorHectarea), unidad: dosisUnidad }
            : null;

      let cantidad = null;
      if (dosisRef) {
        const dosisEnUnidad = dosisRef.valor * (await factorA(dosisRef.unidad.id, unidadNuevaId, nombre));
        const exacta = Math.round((dosisEnUnidad / litrosPorHa) * 100) / 100;
        if (exacta > 0) cantidad = exacta;
      }
      if (cantidad === null) {
        cantidad = Math.round(Number(c.cantidad) * (await factorA(c.unidadId, unidadNuevaId, nombre)) * factorEscala * 100) / 100;
      }
      nuevos.set(c.uuid, { cantidad, unidadId: unidadNuevaId });
    }
    // Agua provisional (se fija abajo, con los valores ya resueltos).
    for (const c of componentes) {
      if (esAgua(c)) nuevos.set(c.uuid, { cantidad: 0, unidadId: await masPequenaDe(c.unidadId) });
    }

    const armarLista = async () => {
      const lista = [];
      for (const c of componentes) {
        const base = await filaGuardadaAEdicion(c);
        const nuevo = nuevos.get(c.uuid);
        lista.push({ ...base, cantidad: nuevo.cantidad, unidadUuid: todasUnidades.find((u) => u.id === nuevo.unidadId)?.uuid || null });
      }
      return lista;
    };

    // Primera pasada: resuelve las dosis relativas para saber cuánto volumen
    // suman TODOS los insumos menos el Agua, y con eso se calcula el Agua.
    let resultado = await calcularCostos(await armarLista(), 1);
    let litrosSinAgua = 0;
    for (let i = 0; i < componentes.length; i += 1) {
      if (esAgua(componentes[i])) continue;
      litrosSinAgua += await litrosDe(resultado.detalles[i].unidadId, Number(resultado.detalles[i].cantidad));
    }
    for (const c of componentes) {
      if (!esAgua(c)) continue;
      const unidadAguaId = nuevos.get(c.uuid).unidadId;
      const enUnidadAgua = Math.max(0, 1 - litrosSinAgua) * (await factorA(litro.id, unidadAguaId, 'Agua'));
      nuevos.set(c.uuid, { cantidad: Math.round(enUnidadAgua * 100) / 100, unidadId: unidadAguaId });
    }
    resultado = await calcularCostos(await armarLista(), 1);
    const { costoTotal, costoUnitario, detalles } = resultado;

    const mezcla = version.mezcla;
    return sequelize.transaction(async (t) => {
      for (let i = 0; i < componentes.length; i += 1) {
        const d = detalles[i];
        await mezclaRepository.updateComponente(
          await mezclaRepository.findComponenteByUuid(componentes[i].uuid, { transaction: t }),
          {
            cantidad: d.cantidad,
            unidadId: d.unidadId,
            costoUnitarioSnapshot: d.costoUnitarioSnapshot,
            costoTotalSnapshot: d.costoTotalSnapshot,
          },
          { transaction: t },
        );
      }
      await propagarDosisRelativas(version.id, { transaction: t });
      // La receta ahora es de 1 litro.
      await mezclaRepository.update(mezcla, { rendimiento: 1, unidadRendimientoId: litro.id, updatedBy: actorId }, { transaction: t });
      await mezclaRepository.updateVersion(
        version,
        { costoTotal, costoUnitario, recetaNormalizada: true, updatedBy: actorId },
        { transaction: t },
      );
      return getVersionOrFail(versionUuid, { transaction: t });
    });
  },

  // Reordena los insumos que TODAVÍA no se midieron (arrastrar y soltar en
  // "Mediciones"). Un insumo ya medido es inamovible: su posición no cambia
  // y ni siquiera se acepta en la lista. Los insumos pendientes se reparten
  // los mismos "huecos" (valores de `orden`) que ya ocupaban, en el orden
  // pedido — así los medidos conservan su lugar. El principal sigue yendo
  // siempre primero al mostrar la receta (ver utils/ordenReceta.js).
  async reordenarComponentes(versionUuid, componenteUuids, actorId) {
    const version = await getVersionOrFail(versionUuid);
    assertVersionEditable(version);

    const componentes = version.componentes || [];
    const medidos = new Set((version.etapas || []).map((e) => e.componenteId).filter(Boolean));
    const pendientes = componentes.filter((c) => !medidos.has(c.id));
    const uuidsPendientes = new Set(pendientes.map((c) => c.uuid));

    const repetidos = new Set(componenteUuids).size !== componenteUuids.length;
    if (repetidos || componenteUuids.length !== uuidsPendientes.size || componenteUuids.some((u) => !uuidsPendientes.has(u))) {
      const uuidsMedidos = new Set(componentes.filter((c) => medidos.has(c.id)).map((c) => c.uuid));
      if (componenteUuids.some((u) => uuidsMedidos.has(u))) {
        throw ApiError.badRequest('Un insumo que ya se midió no se puede mover');
      }
      throw ApiError.badRequest('La lista debe incluir exactamente los insumos que todavía no se midieron');
    }

    const huecos = pendientes.map((c) => c.orden ?? c.id).sort((a, b) => a - b);

    return sequelize.transaction(async (t) => {
      for (let i = 0; i < componenteUuids.length; i += 1) {
        const fila = await mezclaRepository.findComponenteByUuid(componenteUuids[i], { transaction: t });
        await mezclaRepository.updateComponente(fila, { orden: huecos[i] }, { transaction: t });
      }
      await mezclaRepository.updateVersion(version, { updatedBy: actorId }, { transaction: t });
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

    // CORRECCION_PH: el insumo es siempre "ACONDICIONADOR" (se
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
          uuid: payload.uuid,
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
  async registrarHomogeneidad(versionUuid, { uuid, intervalo, homogenea, observaciones }, actorId) {
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
        uuid,
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
    const { costoTotal, costoUnitario, detalles } = await calcularCostos(componentes, rendimiento, {
      totalRef: await totalRefReceta(rendimiento, { unidadUuid: payload.articuloUnidadMedidaUuid }),
    });

    // Volumen/ha se puede cargar desde acá (Nueva mezcla) — antes solo se
    // guardaba editando después con "Editar mezcla".
    let dosisPorHectareaUnidadId = null;
    if (payload.dosisPorHectareaUnidadUuid) {
      const u = await resolveUnidad(payload.dosisPorHectareaUnidadUuid);
      dosisPorHectareaUnidadId = u.id;
    }

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
          dosisPorHectareaUnidadId,
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
            esPrincipal: det.esPrincipal,
            tipoDosis: det.tipoDosis || 'FIJA',
            referenciaArticuloId: det.referenciaArticuloId ?? null,
            porcentajeReferencia: det.porcentajeReferencia ?? null,
            tasa: det.tasa ?? null,
            tasaUnidadId: det.tasaUnidadId ?? null,
            dosisPorHectarea: det.dosisPorHectarea ?? null,
            dosisUnidadId: det.dosisUnidadId ?? null,
          },
          { transaction: t },
        );
      }

      const versionFinal = await getVersionOrFail(version.uuid, { transaction: t });
      return { version: versionFinal };
    });
  },

  // Cargue masivo de mezclas creadas directo (sin prueba de laboratorio) —
  // mismo camino que "Nueva mezcla" (crearDirecta), en lote. El archivo
  // trae UNA FILA POR INSUMO — varias filas con el mismo "nombre" forman
  // la receta completa de una sola mezcla (igual criterio que
  // ingredienteActivoInsumo.service.js#bulkCreateInsumos agrupa por
  // nombre, pero acá cada fila además aporta un insumo distinto en vez de
  // ser 1 fila = 1 registro completo). Columnas esperadas: nombre, codigo
  // (opcional, solo en la primera fila del grupo), categoria (nombre de
  // categoría tipo ELABORADO), unidad (opcional, código de unidad del
  // producto), cantidadAProducir, almacen (código o nombre), dosisPorHectarea
  // (opcional), dosisUnidad (opcional, código de unidad), insumoNombre,
  // insumoCantidad, insumoUnidad (opcional, código de unidad del insumo).
  async bulkCrearDirectas(file, actorId, user, { dryRun = false } = {}) {
    const rows = parseBulkFile(file);
    if (rows.length === 0) throw ApiError.badRequest('El archivo no tiene filas para procesar');

    const nombresCategorias = [...new Set(rows.map((r) => String(r.categoria || '').trim()).filter(Boolean))];
    const categorias = nombresCategorias.length
      ? await ArticuloCategoria.findAll({ where: { nombre: nombresCategorias, tipo: 'ELABORADO' } })
      : [];
    const mapaCategorias = new Map(categorias.map((c) => [c.nombre, c]));

    const codigosUnidades = [
      ...new Set(rows.flatMap((r) => [String(r.unidad || '').trim(), String(r.dosisunidad || '').trim(), String(r.insumounidad || '').trim()]).filter(Boolean)),
    ];
    const unidadesEncontradas = codigosUnidades.length ? await UnidadMedida.findAll({ where: { codigo: codigosUnidades } }) : [];
    const mapaUnidades = new Map(unidadesEncontradas.map((u) => [u.codigo, u]));

    const textosAlmacen = [...new Set(rows.map((r) => String(r.almacen || '').trim()).filter(Boolean))];
    const almacenes = textosAlmacen.length
      ? await Almacen.findAll({ where: { [Op.or]: [{ codigo: textosAlmacen }, { nombre: textosAlmacen }] } })
      : [];
    const mapaAlmacenes = new Map();
    for (const a of almacenes) {
      if (a.codigo) mapaAlmacenes.set(a.codigo, a);
      mapaAlmacenes.set(a.nombre, a);
    }

    const nombresInsumos = [...new Set(rows.map((r) => String(r.insumonombre || '').trim()).filter(Boolean))];
    const insumosEncontrados = nombresInsumos.length ? await Articulo.findAll({ where: { nombre: nombresInsumos } }) : [];
    const mapaInsumos = new Map(insumosEncontrados.map((a) => [a.nombre, a]));

    const nombresMezclaExistentes = [...new Set(rows.map((r) => String(r.nombre || '').trim()).filter(Boolean))];
    const mezclasExistentes = nombresMezclaExistentes.length ? await Mezcla.findAll({ where: { nombre: nombresMezclaExistentes } }) : [];
    const setMezclasExistentes = new Set(mezclasExistentes.map((m) => m.nombre));

    // Agrupa filas por "nombre" preservando el orden de primera aparición
    // — cada grupo es una mezcla completa con todos sus insumos.
    const grupos = new Map();
    const ordenGrupos = [];
    for (let i = 0; i < rows.length; i += 1) {
      const fila = i + 2;
      const row = rows[i];
      const nombre = String(row.nombre || '').trim();
      if (!nombre) continue;
      if (!grupos.has(nombre)) {
        grupos.set(nombre, { nombre, filaInicial: fila, rows: [] });
        ordenGrupos.push(nombre);
      }
      grupos.get(nombre).rows.push({ fila, row });
    }

    const errores = [];
    const gruposValidos = [];

    for (const nombre of ordenGrupos) {
      const grupo = grupos.get(nombre);
      const primera = grupo.rows[0].row;

      if (setMezclasExistentes.has(nombre)) {
        errores.push({ fila: grupo.filaInicial, mensaje: `Ya existe una mezcla llamada "${nombre}" — se omite` });
        continue;
      }

      const categoriaTexto = String(primera.categoria || '').trim();
      const categoria = mapaCategorias.get(categoriaTexto);
      if (!categoria) {
        errores.push({ fila: grupo.filaInicial, mensaje: `Categoría "${categoriaTexto}" no encontrada (debe ser de tipo Elaborado)` });
        continue;
      }

      const unidadTexto = String(primera.unidad || '').trim();
      if (unidadTexto && !mapaUnidades.has(unidadTexto)) {
        errores.push({ fila: grupo.filaInicial, mensaje: `Unidad "${unidadTexto}" no encontrada` });
        continue;
      }

      const almacenTexto = String(primera.almacen || '').trim();
      const almacen = mapaAlmacenes.get(almacenTexto);
      if (!almacen) {
        errores.push({ fila: grupo.filaInicial, mensaje: `Almacén "${almacenTexto}" no encontrado` });
        continue;
      }

      const cantidadAProducir = Number(primera.cantidadaproducir);
      if (!Number.isFinite(cantidadAProducir) || cantidadAProducir <= 0) {
        errores.push({ fila: grupo.filaInicial, mensaje: `cantidadAProducir "${primera.cantidadaproducir}" no es un número válido` });
        continue;
      }

      const dosisTexto = primera.dosisporhectarea;
      const dosisPorHectarea = dosisTexto !== undefined && dosisTexto !== '' ? Number(dosisTexto) : null;
      if (dosisPorHectarea !== null && (!Number.isFinite(dosisPorHectarea) || dosisPorHectarea < 0)) {
        errores.push({ fila: grupo.filaInicial, mensaje: `dosisPorHectarea "${dosisTexto}" no es un número válido` });
        continue;
      }

      let filaConError = false;
      const componentes = [];
      for (const { fila, row } of grupo.rows) {
        const insumoNombre = String(row.insumonombre || '').trim();
        if (!insumoNombre) {
          errores.push({ fila, mensaje: 'Falta la columna requerida: insumoNombre' });
          filaConError = true;
          break;
        }
        const insumo = mapaInsumos.get(insumoNombre);
        if (!insumo) {
          errores.push({ fila, mensaje: `Insumo "${insumoNombre}" no encontrado` });
          filaConError = true;
          break;
        }
        const insumoCantidad = Number(row.insumocantidad);
        if (!Number.isFinite(insumoCantidad) || insumoCantidad <= 0) {
          errores.push({ fila, mensaje: `insumoCantidad "${row.insumocantidad}" no es un número válido` });
          filaConError = true;
          break;
        }
        const insumoUnidadTexto = String(row.insumounidad || '').trim();
        if (insumoUnidadTexto && !mapaUnidades.has(insumoUnidadTexto)) {
          errores.push({ fila, mensaje: `Unidad de insumo "${insumoUnidadTexto}" no encontrada` });
          filaConError = true;
          break;
        }
        componentes.push({
          articuloUuid: insumo.uuid,
          cantidad: insumoCantidad,
          unidadUuid: insumoUnidadTexto ? mapaUnidades.get(insumoUnidadTexto).uuid : null,
        });
      }
      if (filaConError) continue;

      gruposValidos.push({
        articuloNombre: nombre,
        articuloCodigo: primera.codigo ? String(primera.codigo).trim() : null,
        articuloCategoriaUuid: categoria.uuid,
        articuloUnidadMedidaUuid: unidadTexto ? mapaUnidades.get(unidadTexto).uuid : null,
        almacenUuid: almacen.uuid,
        rendimiento: cantidadAProducir,
        dosisPorHectarea,
        componentes,
      });
    }

    if (!dryRun) {
      for (const payload of gruposValidos) {
        await this.crearDirecta(payload, actorId, user);
      }
    }

    return { totalFilas: rows.length, mezclasCreadas: gruposValidos.length, errores };
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

