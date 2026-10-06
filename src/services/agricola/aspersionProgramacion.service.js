import { sequelize } from '../../database/connection.js';
import { aspersionProgramacionRepository } from '../../repositories/agricola/aspersionProgramacion.repository.js';
import { semanaRepository } from '../../repositories/agricola/semana.repository.js';
import {
  Finca,
  Mezcla,
  MezclaVersion,
  MezclaComponente,
  Articulo,
  UnidadMedida,
  Almacen,
  MovimientoInventario,
  AspersionProgramacion,
  User,
  Role,
} from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { generarCorrelativo } from '../../utils/correlativo.js';
import { convertirACantidadBase, resolverFactorConversion } from '../../utils/unidadConversion.js';
import { consumirStockConReceta, RequiereConfirmacionStockError } from '../inventario/stock.helper.js';
import { mailService } from '../sistema/mail.service.js';
import { configuracionService } from '../sistema/configuracion.service.js';
import { ROLES } from '../../constants/roles.constants.js';
import { resolverDestinatarios } from '../../utils/resolverDestinatarios.js';
import { assertAlmacenPermitido, getAlmacenIdsPermitidas } from '../../utils/almacenScope.js';
import { parseBulkFile } from '../../utils/bulkFileParser.js';
import { comprobanteAspersionService } from './comprobanteAspersion.service.js';
import { ordenarComponentesReceta } from '../../utils/ordenReceta.js';
import { Op } from 'sequelize';

const MOTIVO_PREFIJO = 'ASP';
const TIPOS_VALIDOS = ['SIGATOKA_NEGRA', 'DEFOLIADOR', 'FERTILIZACION'];

async function resolveFinca(uuid) {
  const finca = await Finca.findOne({ where: { uuid } });
  if (!finca) throw ApiError.notFound('Finca no encontrada');
  return finca;
}

async function resolveAlmacen(uuid) {
  const almacen = await Almacen.findOne({ where: { uuid } });
  if (!almacen) throw ApiError.notFound('Almacén no encontrado');
  return almacen;
}

// La mezcla debe estar activa (articuloElaborado.estado true) y tener
// dosisPorHectarea configurada — sin eso no hay forma de calcular cuánto
// preparar para las hectáreas indicadas (pedido explícito: "con el día ya se
// calcula la semana, qué mezcla se usará y qué cantidad").
async function resolveMezclaConDosis(uuid) {
  const mezcla = await Mezcla.findOne({ where: { uuid } });
  if (!mezcla) throw ApiError.notFound('Mezcla no encontrada');
  if (!mezcla.dosisPorHectarea) {
    throw ApiError.badRequest(
      `La mezcla "${mezcla.nombre || mezcla.codigo}" no tiene una dosis por hectárea configurada — edítala en Mezclas antes de usarla en una aspersión.`,
    );
  }
  return mezcla;
}

// dosisPorHectarea puede estar en una unidad distinta a la de rendimiento de
// la mezcla (ej. dosis en Galones/ha, mezcla rinde en Litros) — se convierte
// antes de escalar la receta, que trabaja en la unidad de rendimiento (ver
// ejecutar()). Sin dosisPorHectareaUnidadId configurada (mezclas viejas) se
// asume que ya está en la unidad de rendimiento, sin conversión.
async function calcularCantidad(mezcla, hectareas) {
  const cantidadEnUnidadDosis = Number(mezcla.dosisPorHectarea) * hectareas;
  if (!mezcla.dosisPorHectareaUnidadId || mezcla.dosisPorHectareaUnidadId === mezcla.unidadRendimientoId) {
    return cantidadEnUnidadDosis;
  }
  const factor = await resolverFactorConversion(mezcla.dosisPorHectareaUnidadId, mezcla.unidadRendimientoId);
  if (factor === null) {
    throw ApiError.badRequest(
      `No hay conversión registrada entre la unidad de la dosis y la unidad del artículo elaborado de "${mezcla.nombre || mezcla.codigo}" — agrégala en Unidades de Medida.`,
    );
  }
  return cantidadEnUnidadDosis * factor;
}

// Valor TEÓRICO puro de cada insumo de la receta para estas hectáreas —
// nunca lo afecta ningún ajuste manual (ni el del total "cantidad a
// preparar" ni el de una línea puntual). Es lo que se guarda como
// `cantidadCalculada` en cada fila de AspersionProgramacionComponente, y lo
// que la pantalla debe poder mostrar siempre como referencia "de fábrica",
// sin importar qué se haya ajustado después (pedido explícito).
async function calcularComponentesReceta(mezcla, hectareas, { transaction } = {}) {
  const version = await MezclaVersion.findOne({
    where: { mezclaId: mezcla.id, activa: true },
    include: [
      {
        model: MezclaComponente,
        as: 'componentes',
        include: [{ model: Articulo, as: 'articulo', attributes: ['id', 'uuid', 'nombre'] }],
      },
    ],
    transaction,
  });
  if (!version || !version.componentes?.length) return [];

  const cantidadEnUnidadRendimiento = await calcularCantidad(mezcla, hectareas);
  const rendimiento = Number(mezcla.rendimiento || 1) || 1;
  const factor = cantidadEnUnidadRendimiento / rendimiento;
  const unidadRend = mezcla.unidadRendimientoId;

  // Base por renglón: receta escalada, con POR_VOLUMEN resuelto por el total
  // (igual que en el programador web).
  const bases = [];
  for (const comp of version.componentes) {
    let base = Number(comp.cantidad) * factor;
    if (comp.tipoDosis === 'POR_VOLUMEN' && comp.tasa !== null && comp.tasa !== undefined && comp.tasaUnidadId) {
      const tasa = Number(comp.tasa);
      if (tasa > 0 && unidadRend) {
        const factorTasa = unidadRend === comp.tasaUnidadId ? 1 : await resolverFactorConversion(unidadRend, comp.tasaUnidadId, { transaction });
        if (factorTasa !== null) base = cantidadEnUnidadRendimiento * factorTasa * tasa;
      }
    }
    bases.push({ comp, base });
  }

  // Agua-last (igual que el programador): si hay renglón de Agua, completa
  // el total; los POR_LITRO_AGUA salen de esa agua; el ACONDICIONADOR sin
  // regla usa 0.8 g/L como siempre. Sin Agua, todo queda escalado.
  const idxAgua = bases.findIndex(({ comp }) => comp.articulo?.nombre === 'Agua');
  let aguaEnRend = null;
  const litroAgua = await UnidadMedida.findOne({ where: { nombre: 'Litro' }, transaction });
  if (idxAgua >= 0 && unidadRend && litroAgua) {
    let sumaFija = 0;
    let coefPorLitro = 0; // rend por cada litro de agua (renglones por-litro en volumen)
    const litro = litroAgua;
    for (const { comp, base } of bases) {
      if (comp.articulo?.nombre === 'Agua') continue;
      if (comp.tipoDosis === 'POR_LITRO_AGUA' && comp.tasa !== null && comp.tasa !== undefined && litro) {
        const tasa = Number(comp.tasa);
        // El renglón por-litro en volumen aporta volumen al total: se
        // descuenta con álgebra cerrada (ver abajo), no aproximado.
        const fRowALitro = comp.unidadId ? await resolverFactorConversion(comp.unidadId, litro.id, { transaction }) : null;
        if (tasa > 0 && fRowALitro !== null) {
          const fLitroARend = await resolverFactorConversion(litro.id, unidadRend, { transaction });
          if (fLitroARend !== null) {
            coefPorLitro += tasa * fRowALitro * fLitroARend;
            continue;
          }
        }
      }
      if (comp.tipoDosis === 'POR_LITRO_AGUA') continue; // masa: no desplaza volumen
      if (comp.articulo?.nombre === 'ACONDICIONADOR') continue; // se calcula desde el agua abajo
      if (!comp.unidadId) continue;
      const f = comp.unidadId === unidadRend ? 1 : await resolverFactorConversion(comp.unidadId, unidadRend, { transaction });
      if (f !== null) sumaFija += base * f;
    }
    const fRendALitro = await resolverFactorConversion(unidadRend, litro.id, { transaction });
    if (fRendALitro !== null) {
      // A_R = T_R − S_R − coef·A_L ; A_L = A_R·f → A_R = (T_R − S_R)/(1+f·coef)
      aguaEnRend = Math.max(0, (cantidadEnUnidadRendimiento - sumaFija) / (1 + fRendALitro * coefPorLitro));
    }
  }

  const litro = await UnidadMedida.findOne({ where: { nombre: 'Litro' }, transaction });
  const kilogramo = await UnidadMedida.findOne({ where: { nombre: 'Kilogramo' }, transaction });
  const filas = [];
  for (const { comp, base } of bases) {
    let cantidadCalculada = base;
    if (aguaEnRend !== null) {
      if (comp.articulo?.nombre === 'Agua') {
        cantidadCalculada = aguaEnRend;
      } else if (comp.tipoDosis === 'POR_LITRO_AGUA' && comp.tasa !== null && comp.tasa !== undefined && litro) {
        const tasa = Number(comp.tasa);
        const fRendALitro = await resolverFactorConversion(unidadRend, litro.id, { transaction });
        if (tasa > 0 && fRendALitro !== null) cantidadCalculada = tasa * aguaEnRend * fRendALitro;
      } else if (comp.articulo?.nombre === 'ACONDICIONADOR' && comp.tipoDosis !== 'POR_LITRO_AGUA' && litro && kilogramo) {
        // Legacy: 0.8 g/L como en el programador (solo si no trae regla propia).
        const fRendALitro2 = await resolverFactorConversion(unidadRend, litro.id, { transaction });
        if (fRendALitro2 !== null) {
          const aguaLitros = aguaEnRend * fRendALitro2;
          const enKg = (0.8 * aguaLitros) / 1000;
          const fKgARow = comp.unidadId === kilogramo.id ? 1 : await resolverFactorConversion(kilogramo.id, comp.unidadId, { transaction });
          if (fKgARow !== null) cantidadCalculada = enKg * fKgARow;
        }
      }
    }
    filas.push({
      articuloId: comp.articuloId,
      articuloUuid: comp.articulo?.uuid,
      unidadId: comp.unidadId,
      cantidadCalculada,
    });
  }
  return filas;
}

// La celda "mezcla" del cargue masivo puede traer la lista de insumos en
// formato "A | B | C" (igual que "Insumos de la receta") en vez del
// código — se busca la mezcla ACTIVA cuya receta incluya TODOS esos
// productos (puede tener además otros insumos, como Agua o Regulador de
// pH, que el operador no necesita listar). Si varias mezclas califican, se
// usa la que se haya usado más recientemente en una aspersión; si ninguna
// se ha usado todavía, la de versión más reciente.
async function encontrarMezclaPorProductos(nombresProductos) {
  const articulos = [];
  for (const nombre of nombresProductos) {
    const articulo = await Articulo.findOne({ where: { nombre } });
    if (!articulo) return { error: `Insumo "${nombre}" no encontrado` };
    articulos.push(articulo);
  }
  const articuloIds = articulos.map((a) => a.id);

  const versiones = await MezclaVersion.findAll({
    where: { activa: true },
    include: [
      { model: MezclaComponente, as: 'componentes', attributes: ['articuloId'] },
      { model: Mezcla, as: 'mezcla', where: { estado: true }, attributes: ['id', 'uuid', 'nombre', 'codigo', 'dosisPorHectarea'] },
    ],
  });

  const candidatas = versiones.filter((v) => {
    const idsVersion = new Set(v.componentes.map((c) => c.articuloId));
    return articuloIds.every((id) => idsVersion.has(id));
  });
  if (!candidatas.length) {
    return { error: `No se encontró ninguna mezcla activa que incluya: ${nombresProductos.join(', ')}` };
  }
  if (candidatas.length === 1) return { mezcla: candidatas[0].mezcla };

  // Varias coinciden: la que se usó más recientemente en una aspersión.
  const mezclaIds = candidatas.map((v) => v.mezcla.id);
  const usoReciente = await AspersionProgramacion.findOne({
    where: { mezclaId: mezclaIds },
    order: [['createdAt', 'DESC']],
  });
  if (usoReciente) {
    const match = candidatas.find((c) => c.mezcla.id === usoReciente.mezclaId);
    if (match) return { mezcla: match.mezcla };
  }
  // Ninguna se ha usado todavía: la versión (y por ende mezcla) más nueva.
  candidatas.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return { mezcla: candidatas[0].mezcla };
}

// El Excel puede traer la fecha como serial de Excel (número, si la celda
// quedó con formato fecha) o como texto "AAAA-MM-DD"/"DD/MM/AAAA" (si el
// operador la escribió a mano). Devuelve "AAAA-MM-DD" o null si no se
// pudo interpretar.
function parseFechaExcel(valor) {
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    const epoch = Date.UTC(1899, 11, 30);
    const fecha = new Date(epoch + valor * 86400000);
    return fecha.toISOString().slice(0, 10);
  }
  const texto = String(valor || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(texto);
  if (match) {
    const [, d, m, y] = match;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

// Galones de la programación: la "cantidad a preparar" (en la unidad de
// rendimiento de la mezcla) llevada a Galones — se manda en cada fila del
// listado como `galonesProgramados` para precargar el campo "Galones totales"
// del modal de Ejecutar (editable). Null si no hay conversión.
async function adjuntarGalonesProgramados(rows) {
  const galon = await UnidadMedida.findOne({ where: { nombre: 'Galón' } });
  if (!galon) return rows;
  const uuids = [...new Set(rows.map((r) => r.mezcla?.unidadRendimiento?.uuid).filter(Boolean))];
  const unidades = uuids.length ? await UnidadMedida.findAll({ where: { uuid: uuids } }) : [];
  const factores = new Map();
  for (const u of unidades) factores.set(u.uuid, await resolverFactorConversion(u.id, galon.id));
  for (const r of rows) {
    const factor = factores.get(r.mezcla?.unidadRendimiento?.uuid);
    r.setDataValue('galonesProgramados', factor === null || factor === undefined ? null : Math.round(Number(r.cantidadCalculada) * factor * 100) / 100);
  }
  return rows;
}

function assertProgramada(aspersion) {
  if (aspersion.estado !== 'PROGRAMADA') {
    throw ApiError.badRequest(`Esta aspersión ya está ${aspersion.estado.toLowerCase()} y no se puede modificar`);
  }
}

export const aspersionProgramacionService = {
  async list(query, user) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await aspersionProgramacionRepository.findAndCountAll({
      limit,
      offset,
      fincaUuid: query.fincaUuid,
      semanaUuid: query.semanaUuid,
      mezclaUuid: query.mezclaUuid,
      estado: query.estado,
      tipo: query.tipo,
      fechaDesde: query.fechaDesde,
      fechaHasta: query.fechaHasta,
      almacenIdsPermitidos: getAlmacenIdsPermitidas(user),
      search: query.search,
    });
    await adjuntarGalonesProgramados(rows);
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  // `user` opcional: si se da y la programación está en un almacén fuera del
  // alcance del usuario, se trata como si no existiera (404) — mismo
  // criterio que almacen.service.js#getByUuid. Todas las acciones puntuales
  // (update/delete/cancelar/ejecutar/actualizarComponente) pasan por acá, así
  // que quedan protegidas con este único chequeo.
  async getByUuid(uuid, user) {
    const aspersion = await aspersionProgramacionRepository.findByUuid(uuid);
    if (!aspersion) throw ApiError.notFound('Programación de aspersión no encontrada');
    const permitidos = getAlmacenIdsPermitidas(user);
    if (permitidos !== null && !permitidos.includes(aspersion.almacenId)) {
      throw ApiError.notFound('Programación de aspersión no encontrada');
    }
    return aspersion;
  },

  // Usuarios asignados a la finca (Configuración → Usuarios → Fincas) — el
  // pedido explícito es que "Administrador de finca" se elija de ahí, no de
  // texto libre. Una finca sin usuarios asignados (el caso común, ver
  // fincaScope.js: sin asignación = ve todo) simplemente no tiene candidatos
  // — el frontend deja el campo como texto libre en ese caso.
  async listUsuariosFinca(fincaUuid) {
    const finca = await Finca.findOne({
      where: { uuid: fincaUuid },
      // 'cargo': ya existe en el usuario (Configuración → Usuarios) — se
      // usa tal cual para la firma del aviso, no hace falta duplicarlo.
      include: [{ model: User, as: 'usuarios', attributes: ['uuid', 'usuario', 'nombre', 'apellido', 'cargo'], through: { attributes: [] } }],
    });
    if (!finca) throw ApiError.notFound('Finca no encontrada');
    return finca.usuarios || [];
  },

  // Mezclas activas con los insumos de su receta, para la hoja "Mezclas" de
  // la plantilla de cargue masivo (referencia de qué nombre/código escribir
  // en la columna "mezcla"). A propósito vive acá y no en /inventarios/
  // mezclas: cualquiera con permiso de ver/programar aspersiones debe poder
  // descargar la plantilla completa.
  async listMezclasReferencia() {
    // Solo las utilizables: activas y con volumen por hectárea (sin él,
    // crear la aspersión falla — ver resolveMezclaConDosis).
    const mezclas = await Mezcla.findAll({
      where: { estado: true, dosisPorHectarea: { [Op.gt]: 0 } },
      attributes: ['uuid', 'codigo', 'nombre', 'rendimiento', 'dosisPorHectarea'],
      include: [
        { model: UnidadMedida, as: 'unidadRendimiento', attributes: ['simbolo'] },
        { model: UnidadMedida, as: 'dosisPorHectareaUnidad', attributes: ['simbolo'] },
        {
          model: MezclaVersion,
          as: 'versiones',
          where: { activa: true },
          required: false,
          attributes: ['version'],
          include: [
            {
              model: MezclaComponente,
              as: 'componentes',
              attributes: ['id', 'orden', 'esPrincipal'],
              include: [
                { model: Articulo, as: 'articulo', attributes: ['nombre'] },
              ],
            },
          ],
        },
      ],
      order: [['nombre', 'ASC']],
    });
    return mezclas.map((m) => ({
      uuid: m.uuid,
      codigo: m.codigo,
      nombre: m.nombre,
      volumenPorHectarea: m.dosisPorHectarea !== null && m.dosisPorHectarea !== undefined ? Number(m.dosisPorHectarea) : null,
      volumenPorHectareaUnidad: m.dosisPorHectareaUnidad?.simbolo || m.unidadRendimiento?.simbolo || '',
      // Orden único de la receta (ver utils/ordenReceta.js).
      insumos: ordenarComponentesReceta(m.versiones?.[0]?.componentes || []).map((c) => ({
        nombre: c.articulo?.nombre || '',
        esPrincipal: Boolean(c.esPrincipal),
      })),
    }));
  },

  async create(payload, actorId, user) {
    const finca = await resolveFinca(payload.fincaUuid);
    const almacen = await resolveAlmacen(payload.almacenUuid);
    assertAlmacenPermitido(user, almacen.id);
    const mezcla = await resolveMezclaConDosis(payload.mezclaUuid);

    const hectareas = Number(payload.hectareas);
    // Se sugiere sola (dosis × hectáreas), pero el operador la puede
    // corregir a mano antes de guardar (ej. redondear al tamaño real del
    // tanque de aspersión) — si vino en el payload, se respeta esa en vez
    // de recalcularla.
    const cantidadCalculada = payload.cantidad !== undefined ? Number(payload.cantidad) : await calcularCantidad(mezcla, hectareas);

    // La semana se resuelve contra la tabla `Semana` ya generada
    // (Configuración → Semanas) — si esa fecha todavía no tiene semana
    // generada, no bloquea la programación, solo queda sin semana asignada.
    const semana = await semanaRepository.findByFecha(payload.fecha);

    return sequelize.transaction(async (t) => {
      const numero = await generarCorrelativo(AspersionProgramacion, { prefijo: MOTIVO_PREFIJO, columna: 'numero', transaction: t });

      const aspersion = await aspersionProgramacionRepository.create(
        {
          numero,
          fincaId: finca.id,
          fecha: payload.fecha,
          semanaId: semana?.id || null,
          tipo: payload.tipo,
          medio: payload.medio,
          mezclaId: mezcla.id,
          almacenId: almacen.id,
          hectareas,
          cantidadCalculada,
          estado: 'PROGRAMADA',
          representanteCorbanaNombre: payload.representanteCorbanaNombre || null,
          administradorFincaNombre: payload.administradorFincaNombre || null,
          observaciones: payload.observaciones || null,
          usuarioId: actorId,
          createdBy: actorId,
        },
        { transaction: t },
      );

      // Snapshot de insumos: nace con la cantidad calculada de la receta,
      // salvo que el operador haya ajustado alguna línea al programar (ver
      // createAspersionSchema#componentes) — ese ajuste queda en `cantidad`,
      // la teórica siempre en `cantidadCalculada` (nunca se pisa).
      const componentesReceta = await calcularComponentesReceta(mezcla, hectareas, { transaction: t });
      const overridesPorArticulo = new Map((payload.componentes || []).map((c) => [c.articuloUuid, Number(c.cantidad)]));
      await aspersionProgramacionRepository.replaceComponentes(
        aspersion.id,
        componentesReceta.map((c) => ({
          articuloId: c.articuloId,
          unidadId: c.unidadId,
          cantidadCalculada: c.cantidadCalculada,
          cantidad: overridesPorArticulo.has(c.articuloUuid) ? overridesPorArticulo.get(c.articuloUuid) : c.cantidadCalculada,
          createdBy: actorId,
        })),
        { transaction: t },
      );

      return aspersionProgramacionRepository.findByUuid(aspersion.uuid, { transaction: t });
    });
  },

  // Cargue masivo desde .csv/.xlsx — una fila por vuelo. Columnas:
  // medio, almacen, fecha, finca, observaciones (opcional), hectareas,
  // tipo (opcional, SIGATOKA_NEGRA por defecto), mezcla: código o nombre
  // de una mezcla activa, O la lista de insumos de su receta en el formato
  // "INSUMO1 | INSUMO2 | ..." (igual que la columna "Insumos de la receta"
  // de la pestaña de Mezclas — se busca la mezcla activa cuya receta
  // incluya TODOS esos insumos). Cada fila válida se crea llamando a this.create(), así se
  // reutiliza exactamente el mismo cálculo de cantidades/receta que crear
  // una aspersión a mano — ninguna lógica duplicada acá.
  async bulkCrear(file, actorId, user, { dryRun = false } = {}) {
    const rows = parseBulkFile(file);
    const errores = [];
    const filasValidas = [];

    const fincas = await Finca.findAll({ where: { estado: true } });
    const almacenes = await Almacen.findAll({ where: { estado: true } });
    const mapaFincas = new Map();
    for (const f of fincas) {
      mapaFincas.set(f.nombre.trim().toLowerCase(), f);
      if (f.codigo) mapaFincas.set(String(f.codigo).trim().toLowerCase(), f);
    }
    const mapaAlmacenes = new Map();
    for (const a of almacenes) {
      mapaAlmacenes.set(a.nombre.trim().toLowerCase(), a);
      if (a.codigo) mapaAlmacenes.set(String(a.codigo).trim().toLowerCase(), a);
    }

    const mezclasActivas = await Mezcla.findAll({ where: { estado: true } });
    const mapaMezclas = new Map();
    for (const m of mezclasActivas) {
      if (m.nombre) mapaMezclas.set(m.nombre.trim().toLowerCase(), m);
      if (m.codigo) mapaMezclas.set(String(m.codigo).trim().toLowerCase(), m);
    }

    let fila = 1;
    for (const row of rows) {
      fila++;
      const medio = String(row.medio || '').trim().toUpperCase();
      // Fila completamente vacía (ej. una finca sin aspersión esta semana
      // en la plantilla precargada) — se ignora en silencio, no es error.
      if (!medio && !row.finca && !row.hectareas) continue;

      if (!['AVION', 'DRON'].includes(medio)) {
        errores.push({ fila, mensaje: `medio "${row.medio}" debe ser AVION o DRON` });
        continue;
      }

      const almacen = mapaAlmacenes.get(String(row.almacen || '').trim().toLowerCase());
      if (!almacen) {
        errores.push({ fila, mensaje: `Almacén "${row.almacen}" no encontrado` });
        continue;
      }

      const fecha = parseFechaExcel(row.fecha);
      if (!fecha) {
        errores.push({ fila, mensaje: `fecha "${row.fecha}" no es una fecha válida` });
        continue;
      }

      const finca = mapaFincas.get(String(row.finca || '').trim().toLowerCase());
      if (!finca) {
        errores.push({ fila, mensaje: `Finca "${row.finca}" no encontrada` });
        continue;
      }

      const hectareas = Number(row.hectareas);
      if (!Number.isFinite(hectareas) || hectareas <= 0) {
        errores.push({ fila, mensaje: `hectareas "${row.hectareas}" no es un número válido` });
        continue;
      }

      const tipoTexto = String(row.tipo || '').trim().toUpperCase();
      if (tipoTexto && !TIPOS_VALIDOS.includes(tipoTexto)) {
        errores.push({ fila, mensaje: `tipo "${row.tipo}" no es válido (usa SIGATOKA_NEGRA, DEFOLIADOR o FERTILIZACION)` });
        continue;
      }
      const tipo = [tipoTexto || 'SIGATOKA_NEGRA'];

      const mezclaTexto = String(row.mezcla || '').trim();
      if (!mezclaTexto) {
        errores.push({ fila, mensaje: 'No se indicó la mezcla' });
        continue;
      }
      let mezcla = mapaMezclas.get(mezclaTexto.toLowerCase());
      if (!mezcla && mezclaTexto.includes('|')) {
        // Formato "Insumos de la receta" (ej. "PALADIUM 250 EC | MANCOL 430
        // SC | ACEITE BANOLE | ...", copiable directo de la hoja "Mezclas"
        // de la plantilla): se busca la mezcla activa cuya receta incluya
        // TODOS esos insumos (si varias califican, la usada más
        // recientemente).
        const nombres = mezclaTexto
          .split('|')
          .map((s) => s.trim())
          .filter(Boolean);
        if (nombres.length) {
          const hallada = await encontrarMezclaPorProductos(nombres);
          if (hallada.error) {
            errores.push({ fila, mensaje: `${hallada.error} (en "${mezclaTexto}")` });
            continue;
          }
          mezcla = hallada.mezcla;
        }
      }
      if (!mezcla) {
        errores.push({
          fila,
          mensaje: `Mezcla "${mezclaTexto}" no encontrada o inactiva — usa su código/nombre o la lista "INSUMO1 | INSUMO2 | ..." de su receta`,
        });
        continue;
      }

      filasValidas.push({
        fila,
        payload: {
          fincaUuid: finca.uuid,
          fecha,
          tipo,
          medio,
          mezclaUuid: mezcla.uuid,
          almacenUuid: almacen.uuid,
          hectareas,
          observaciones: row.observaciones || null,
        },
      });
    }

    let creadas = 0;
    if (!dryRun) {
      for (const { fila: filaNum, payload } of filasValidas) {
        try {
          await this.create(payload, actorId, user);
          creadas++;
        } catch (err) {
          errores.push({ fila: filaNum, mensaje: err.message });
        }
      }
    }

    return { totalFilas: rows.length, aspersionesCreadas: dryRun ? filasValidas.length : creadas, errores };
  },

  async update(uuid, payload, actorId, user) {
    const aspersion = await this.getByUuid(uuid, user);
    assertProgramada(aspersion);

    const data = { updatedBy: actorId };

    if (payload.fincaUuid) data.fincaId = (await resolveFinca(payload.fincaUuid)).id;
    if (payload.almacenUuid) {
      const nuevoAlmacen = await resolveAlmacen(payload.almacenUuid);
      assertAlmacenPermitido(user, nuevoAlmacen.id);
      data.almacenId = nuevoAlmacen.id;
    }

    let mezcla = null;
    if (payload.mezclaUuid) {
      mezcla = await resolveMezclaConDosis(payload.mezclaUuid);
      data.mezclaId = mezcla.id;
    }

    if (payload.fecha) {
      data.fecha = payload.fecha;
      const semana = await semanaRepository.findByFecha(payload.fecha);
      data.semanaId = semana?.id || null;
    }

    if (payload.tipo) data.tipo = payload.tipo;
    if (payload.medio) data.medio = payload.medio;
    if (payload.observaciones !== undefined) data.observaciones = payload.observaciones || null;
    if (payload.representanteCorbanaNombre !== undefined) data.representanteCorbanaNombre = payload.representanteCorbanaNombre || null;
    if (payload.administradorFincaNombre !== undefined) data.administradorFincaNombre = payload.administradorFincaNombre || null;

    // Si cambia la mezcla o las hectáreas, cambia qué insumos/cantidades
    // teóricas corresponden — hay que recalcular y reemplazar TODAS las
    // filas de componentes (mismo criterio "destruir y recrear" que
    // mezcla.service.js#setComponentes usa para MezclaComponente). Un
    // ajuste anterior por línea no sobrevive a esto, igual que el ajuste
    // del total tampoco sobrevive hoy.
    const hectareas = payload.hectareas !== undefined ? Number(payload.hectareas) : Number(aspersion.hectareas);
    const recalcularComponentes = payload.hectareas !== undefined || mezcla || payload.componentes !== undefined;
    if (recalcularComponentes) {
      data.hectareas = hectareas;
      data.cantidadCalculada = await calcularCantidad(mezcla || aspersion.mezcla, hectareas);
    }
    // Ajuste manual explícito de la cantidad — pisa lo recalculado arriba si
    // ambos vinieron en el mismo payload (ver create()).
    if (payload.cantidad !== undefined) {
      data.cantidadCalculada = Number(payload.cantidad);
    }

    return sequelize.transaction(async (t) => {
      await aspersionProgramacionRepository.update(aspersion, data, { transaction: t });

      if (recalcularComponentes) {
        const componentesReceta = await calcularComponentesReceta(mezcla || aspersion.mezcla, hectareas, { transaction: t });
        // Igual que create(): la cantidad que el operador dejó en pantalla
        // por insumo se guarda en `cantidad`; la teórica de la receta
        // siempre queda en `cantidadCalculada`.
        const overridesPorArticulo = new Map((payload.componentes || []).map((c) => [c.articuloUuid, Number(c.cantidad)]));
        await aspersionProgramacionRepository.replaceComponentes(
          aspersion.id,
          componentesReceta.map((c) => ({
            articuloId: c.articuloId,
            unidadId: c.unidadId,
            cantidadCalculada: c.cantidadCalculada,
            cantidad: overridesPorArticulo.has(c.articuloUuid) ? overridesPorArticulo.get(c.articuloUuid) : c.cantidadCalculada,
            createdBy: actorId,
          })),
          { transaction: t },
        );
      }

      return aspersionProgramacionRepository.findByUuid(uuid, { transaction: t });
    });
  },

  // Ajuste manual de UN insumo puntual — nunca toca `cantidadCalculada`
  // (la referencia teórica de la receta), solo `cantidad` (lo que
  // ejecutar() va a consumir de verdad). Pedido explícito: la pantalla
  // debe poder mostrar siempre ambas.
  async actualizarComponente(aspersionUuid, componenteUuid, cantidad, actorId, user) {
    const aspersion = await this.getByUuid(aspersionUuid, user);
    assertProgramada(aspersion);

    const componente = await aspersionProgramacionRepository.findComponenteByUuid(componenteUuid);
    if (!componente || componente.aspersionProgramacionId !== aspersion.id) {
      throw ApiError.notFound('Insumo no encontrado en esta aspersión');
    }

    await aspersionProgramacionRepository.updateComponente(componente, { cantidad: Number(cantidad), updatedBy: actorId });
    return aspersionProgramacionRepository.findByUuid(aspersionUuid);
  },

  async delete(uuid, actorId, user) {
    const aspersion = await this.getByUuid(uuid, user);
    assertProgramada(aspersion);
    await aspersionProgramacionRepository.softDelete(aspersion, actorId);
  },

  // Al cancelar, se avisa automáticamente por correo a los destinatarios
  // configurados para esta finca (Configuración → Programación de
  // Aspersiones → Destinatarios) — sin bloquear la cancelación si no hay
  // nadie configurado o si el envío falla (la cancelación en sí ya quedó
  // guardada; el correo es un aviso adicional, no un requisito).
  async cancelar(uuid, actorId, user) {
    const aspersion = await this.getByUuid(uuid, user);
    assertProgramada(aspersion);
    // `correoEnviadoEn` se reinicia: el aviso que se había mandado ya no
    // aplica (la aspersión no va a pasar), así que el estado de envío
    // vuelve a "pendiente" — el correo de cancelación automático de abajo
    // sí sale, pero el ícono de correo en la fila debe reflejar que este
    // aviso concreto (el nuevo, de cancelación) todavía no se reenvía a
    // mano si hiciera falta.
    await aspersionProgramacionRepository.update(aspersion, { estado: 'CANCELADA', correoEnviadoEn: null, updatedBy: actorId });
    const actualizada = await aspersionProgramacionRepository.findByUuid(uuid);

    try {
      const destinatarios = await this.resolverDestinatariosConfigurados(actualizada.fincaId);
      if (destinatarios.length) {
        await mailService.sendCancelacionAspersion({
          destinatarios,
          fincaNombre: actualizada.finca?.nombre || '',
          fecha: actualizada.fecha,
          semanaCodigo: actualizada.semana?.codigo || '—',
          tipo: actualizada.tipo,
          mezclaNombre: actualizada.mezcla?.nombre || actualizada.mezcla?.codigo || '',
        });
      }
    } catch (err) {
      console.error('No se pudo enviar el correo de cancelación de aspersión:', err.message);
    }

    return actualizada;
  },

  // Marca la aspersión como ejecutada y descuenta los insumos de la mezcla
  // usada (nunca el "saldo" del elaborado en sí — ver
  // stock.helper.js#consumirStockConReceta, mismo invariante que
  // Elaboraciones/Mezclas: "un elaborado nunca tiene saldo propio").
  // `forzarSaldoNegativo`: mismo patrón warn+force ya usado en todo el
  // módulo de inventario — si algún insumo no alcanza, no bloquea de una,
  // junta la advertencia y devuelve `{ requiereConfirmacion: true }` sin
  // escribir nada hasta que se confirme.
  async ejecutar(uuid, actorId, { forzarSaldoNegativo = false, comprobante: datosComprobante } = {}, user) {
    const aspersion = await this.getByUuid(uuid, user);
    assertProgramada(aspersion);

    if (!aspersion.componentes?.length) {
      throw ApiError.badRequest('Esta aspersión no tiene insumos guardados — vuelve a programarla');
    }

    try {
      return await sequelize.transaction(async (t) => {
        const fresh = await aspersionProgramacionRepository.findByUuid(uuid, { transaction: t });
        if (fresh.estado !== 'PROGRAMADA') throw ApiError.conflict('Esta aspersión ya fue procesada');

        const documento = fresh.numero;
        const advertencias = [];

        // Se consume EXACTAMENTE lo que quedó guardado al programar (`fila.
        // cantidad`, que puede ser el valor de la receta o un ajuste manual
        // por línea) — no se recalcula desde la receta en vivo de la
        // mezcla, así un cambio posterior a la receta no afecta una
        // aspersión ya programada.
        for (const fila of fresh.componentes) {
          const cantidadBase = await convertirACantidadBase(fila.articulo, fila.unidadId, Number(fila.cantidad), { transaction: t });
          await consumirStockConReceta(fresh.almacenId, fila.articulo, cantidadBase, {
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
                  almacenId: fresh.almacenId,
                  articuloId: leafArticulo.id,
                  cantidad: leafCantidadBase,
                  cantidadBase: leafCantidadBase,
                  unidadId: leafArticulo.unidadMedidaId || null,
                  costoUnitario: costoUnit,
                  costoTotal: costoUnit * leafCantidadBase,
                  observaciones: `Aspersión ${documento} — finca ${fresh.finca?.nombre || ''} — insumo ${leafArticulo.nombre}`,
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

        await aspersionProgramacionRepository.update(
          fresh,
          {
            estado: 'EJECUTADA',
            fechaEjecucion: new Date().toISOString().slice(0, 10),
            movimientoDocumento: documento,
            updatedBy: actorId,
          },
          { transaction: t },
        );

        // Comprobante de aplicación en BORRADOR, en la misma transacción: si
        // algo falla, no queda ejecutada una aspersión sin su comprobante.
        const comprobante = await comprobanteAspersionService.crearBorradorDesdeEjecucion(fresh, datosComprobante, actorId, { transaction: t });

        return {
          requiereConfirmacion: false,
          advertencias: [],
          aspersion: await aspersionProgramacionRepository.findByUuid(uuid, { transaction: t }),
          comprobante: { uuid: comprobante.uuid, numero: comprobante.numero },
        };
      });
    } catch (err) {
      if (err instanceof RequiereConfirmacionStockError) {
        return { requiereConfirmacion: true, advertencias: err.advertencias, aspersion: null };
      }
      throw err;
    }
  },

  // Resuelve la config de Configuración → destinatarios de Programación de
  // Aspersiones (ver configuracion.service.js#getAspersionDestinatarios) a
  // una lista real de emails para la finca de la programación. Correos
  // sueltos y usuarios puntuales siempre entran, sin importar la finca —
  // son gente que el administrador decidió agregar a mano. Los roles se
  // filtran: solo entran los usuarios de ese rol que tengan esta finca
  // habilitada (Configuración → Usuarios → Fincas) o que no tengan ninguna
  // finca asignada (ven todas, mismo criterio que fincaScope.js).
  async resolverDestinatariosConfigurados(fincaId) {
    const config = await configuracionService.getAspersionDestinatarios();
    const porEmail = new Map();

    for (const email of config.correos) {
      const limpio = String(email || '').trim().toLowerCase();
      if (limpio) porEmail.set(limpio, limpio);
    }

    if (config.usuariosUuids.length) {
      const puntuales = await User.findAll({ where: { uuid: config.usuariosUuids, estado: true } });
      for (const u of puntuales) {
        if (u.email) porEmail.set(u.email.trim().toLowerCase(), u.email);
      }
    }

    if (config.rolesUuids.length) {
      const usuariosPorRol = await User.findAll({
        where: { estado: true },
        include: [
          { model: Role, as: 'roles', where: { uuid: config.rolesUuids }, through: { attributes: [] } },
          { model: Finca, as: 'fincas', attributes: ['id'], through: { attributes: [] }, required: false },
        ],
      });
      for (const u of usuariosPorRol) {
        if (!u.email) continue;
        const esAdmin = (u.roles || []).some((r) => r.nombre === ROLES.ADMINISTRADOR);
        const fincasAsignadas = (u.fincas || []).map((f) => f.id);
        const veTodas = esAdmin || fincasAsignadas.length === 0;
        if (veTodas || fincasAsignadas.includes(fincaId)) {
          porEmail.set(u.email.trim().toLowerCase(), u.email);
        }
      }
    }

    return [...porEmail.values()];
  },

  // Envía el aviso (PDF armado en el navegador, ver
  // app-corbana/lib/aspersionExport.js) por correo al/los destinatario(s)
  // indicados — el backend nunca genera el PDF, solo lo adjunta y despacha
  // (mismo patrón que laborCultural.service.js#enviarCorreoRevision).
  async enviarCorreo(uuid, { destinatarios, pdfBuffer, pdfNombre }) {
    const aspersion = await this.getByUuid(uuid);
    if (!destinatarios?.length) throw ApiError.badRequest('Indica al menos un destinatario');

    // En copia van, además, los destinatarios configurados para esta finca
    // (Configuración → Programación de Aspersiones → Destinatarios) — sin
    // duplicar a nadie que ya esté como destinatario principal.
    const configurados = await this.resolverDestinatariosConfigurados(aspersion.fincaId);
    const cc = configurados.filter((c) => !destinatarios.some((d) => d.toLowerCase() === c.toLowerCase()));

    const datosCorreo = {
      fincaNombre: aspersion.finca?.nombre || '',
      fecha: aspersion.fecha,
      semanaCodigo: aspersion.semana?.codigo || '—',
      tipo: aspersion.tipo,
      mezclaNombre: aspersion.mezcla?.nombre || aspersion.mezcla?.codigo || '',
    };

    // Si la aspersión ya está cancelada (ej. se reenvía el PDF, que ya sale
    // con la marca de agua "CANCELADO"), el correo también debe avisar la
    // cancelación en vez del texto de "se realizará el aviso" — no tendría
    // sentido invitar a una aspersión que ya no va a pasar.
    if (aspersion.estado === 'CANCELADA') {
      await mailService.sendCancelacionAspersion({ destinatarios: [...destinatarios, ...cc], ...datosCorreo });
    } else {
      await mailService.sendAvisoAspersion({ destinatarios, cc, ...datosCorreo, pdfBuffer, pdfNombre });
    }

    await aspersionProgramacionRepository.update(aspersion, { correoEnviadoEn: new Date() });
    return aspersionProgramacionRepository.findByUuid(uuid);
  },

  // Envía el resumen semanal (Excel armado en el navegador, mismo botón
  // "Excel" del Calendario) a los destinatarios de Configuración →
  // Programación de Aspersiones → Resumen semanal — un correo aparte del
  // aviso por aspersión, sin filtro de finca (un solo Excel con toda la
  // semana). Disparado por el botón "Enviar semana" del Calendario.
  async enviarResumenSemanal(semanaUuid, { excelBuffer, excelNombre }) {
    const semana = await semanaRepository.findByUuid(semanaUuid);
    if (!semana) throw ApiError.notFound('Semana no encontrada');

    const config = await configuracionService.getAspersionResumenSemanalDestinatarios();
    const personas = await resolverDestinatarios(config);
    const destinatarios = personas.map((p) => p.email).filter(Boolean);
    if (!destinatarios.length) {
      throw ApiError.badRequest('No hay destinatarios configurados para el resumen semanal — configúralos primero');
    }

    await mailService.sendResumenSemanalAspersiones({
      destinatarios,
      semanaCodigo: semana.codigo,
      excelBuffer,
      excelNombre,
    });

    return { destinatarios, semanaCodigo: semana.codigo };
  },
};

export default aspersionProgramacionService;
