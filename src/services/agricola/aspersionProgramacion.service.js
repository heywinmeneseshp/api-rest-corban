import { sequelize } from '../../database/connection.js';
import { aspersionProgramacionRepository } from '../../repositories/agricola/aspersionProgramacion.repository.js';
import { semanaRepository } from '../../repositories/agricola/semana.repository.js';
import {
  Finca,
  Mezcla,
  MezclaVersion,
  MezclaComponente,
  Articulo,
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

const MOTIVO_PREFIJO = 'ASP';

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
    include: [{ model: MezclaComponente, as: 'componentes', include: [{ model: Articulo, as: 'articulo', attributes: ['id', 'uuid'] }] }],
    transaction,
  });
  if (!version || !version.componentes?.length) return [];

  const cantidadEnUnidadRendimiento = await calcularCantidad(mezcla, hectareas);
  const rendimiento = Number(mezcla.rendimiento || 1) || 1;
  const factor = cantidadEnUnidadRendimiento / rendimiento;

  return version.componentes.map((comp) => ({
    articuloId: comp.articuloId,
    articuloUuid: comp.articulo?.uuid,
    unidadId: comp.unidadId,
    cantidadCalculada: Number(comp.cantidad) * factor,
  }));
}

function assertProgramada(aspersion) {
  if (aspersion.estado !== 'PROGRAMADA') {
    throw ApiError.badRequest(`Esta aspersión ya está ${aspersion.estado.toLowerCase()} y no se puede modificar`);
  }
}

export const aspersionProgramacionService = {
  async list(query) {
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
      search: query.search,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getByUuid(uuid) {
    const aspersion = await aspersionProgramacionRepository.findByUuid(uuid);
    if (!aspersion) throw ApiError.notFound('Programación de aspersión no encontrada');
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

  async create(payload, actorId) {
    const finca = await resolveFinca(payload.fincaUuid);
    const almacen = await resolveAlmacen(payload.almacenUuid);
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

  async update(uuid, payload, actorId) {
    const aspersion = await this.getByUuid(uuid);
    assertProgramada(aspersion);

    const data = { updatedBy: actorId };

    if (payload.fincaUuid) data.fincaId = (await resolveFinca(payload.fincaUuid)).id;
    if (payload.almacenUuid) data.almacenId = (await resolveAlmacen(payload.almacenUuid)).id;

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
    const recalcularComponentes = payload.hectareas !== undefined || mezcla;
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
        await aspersionProgramacionRepository.replaceComponentes(
          aspersion.id,
          componentesReceta.map((c) => ({
            articuloId: c.articuloId,
            unidadId: c.unidadId,
            cantidadCalculada: c.cantidadCalculada,
            cantidad: c.cantidadCalculada,
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
  async actualizarComponente(aspersionUuid, componenteUuid, cantidad, actorId) {
    const aspersion = await this.getByUuid(aspersionUuid);
    assertProgramada(aspersion);

    const componente = await aspersionProgramacionRepository.findComponenteByUuid(componenteUuid);
    if (!componente || componente.aspersionProgramacionId !== aspersion.id) {
      throw ApiError.notFound('Insumo no encontrado en esta aspersión');
    }

    await aspersionProgramacionRepository.updateComponente(componente, { cantidad: Number(cantidad), updatedBy: actorId });
    return aspersionProgramacionRepository.findByUuid(aspersionUuid);
  },

  async delete(uuid, actorId) {
    const aspersion = await this.getByUuid(uuid);
    assertProgramada(aspersion);
    await aspersionProgramacionRepository.softDelete(aspersion, actorId);
  },

  // Al cancelar, se avisa automáticamente por correo a los destinatarios
  // configurados para esta finca (Configuración → Programación de
  // Aspersiones → Destinatarios) — sin bloquear la cancelación si no hay
  // nadie configurado o si el envío falla (la cancelación en sí ya quedó
  // guardada; el correo es un aviso adicional, no un requisito).
  async cancelar(uuid, actorId) {
    const aspersion = await this.getByUuid(uuid);
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
  async ejecutar(uuid, actorId, { forzarSaldoNegativo = false } = {}) {
    const aspersion = await this.getByUuid(uuid);
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

        return { requiereConfirmacion: false, advertencias: [], aspersion: await aspersionProgramacionRepository.findByUuid(uuid, { transaction: t }) };
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
