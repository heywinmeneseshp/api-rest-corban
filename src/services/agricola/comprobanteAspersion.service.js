import { sequelize } from '../../database/connection.js';
import { comprobanteAspersionRepository } from '../../repositories/agricola/comprobanteAspersion.repository.js';
import { Op } from 'sequelize';
import {
  ComprobanteAspersion,
  ComprobanteAspersionParticipante,
  AspersionProgramacion,
  Colaborador,
  Cargo,
  Finca,
  MezclaVersion,
  MezclaComponente,
  UnidadMedida,
} from '../../database/associations.js';
import { claveCargo } from '../seguridad/cargo.service.js';
import { mailService } from '../sistema/mail.service.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { generarCorrelativo } from '../../utils/correlativo.js';
import { resolverFactorConversion } from '../../utils/unidadConversion.js';
import { ordenarComponentesReceta } from '../../utils/ordenReceta.js';
import { getAlmacenIdsPermitidas } from '../../utils/almacenScope.js';

const PREFIJO = 'CMP';

// ─── Piloto de dron y asistentes ───
// Con dron, el piloto se elige del listado de colaboradores (cargo «Piloto de Dron») y se agregan asistentes: cada uno suma las
// hectáreas aplicadas del comprobante (se les paga por hectárea asperjada). Con avión el piloto es externo y sigue escrito.
export const CARGO_PILOTO_DRON = 'Piloto de Dron';
const nombreColaborador = (c) => (c ? `${c.nombre} ${c.apellido || ''}`.trim() : null);
const esPilotoDeDron = (c) => claveCargo(c?.cargo) === claveCargo(CARGO_PILOTO_DRON);

async function colaboradorActivoOFallar(uuid, { transaction } = {}) {
  const c = await Colaborador.findOne({ where: { uuid }, transaction });
  if (!c || !c.estado) throw ApiError.badRequest('Uno de los colaboradores elegidos no existe o está inactivo');
  return c;
}

// Guarda el piloto y los asistentes del comprobante según el medio. Devuelve los campos del comprobante a actualizar.
// `datos`: { pilotoColaboradorUuid, asistentesUuids } (con `undefined` no se tocan).
async function aplicarParticipantes(comprobante, medio, datos, actorId, { transaction } = {}) {
  if (medio !== 'DRON') {
    // Avión (o sin medio): piloto escrito, sin participantes.
    await ComprobanteAspersionParticipante.destroy({ where: { comprobanteId: comprobante.id }, transaction });
    return { pilotoColaboradorId: null };
  }
  if (datos.pilotoColaboradorUuid === undefined && datos.asistentesUuids === undefined) return {};
  const actuales = await ComprobanteAspersionParticipante.findAll({ where: { comprobanteId: comprobante.id }, transaction });
  let piloto = null;
  if (datos.pilotoColaboradorUuid !== undefined) {
    if (datos.pilotoColaboradorUuid) {
      piloto = await colaboradorActivoOFallar(datos.pilotoColaboradorUuid, { transaction });
      if (!esPilotoDeDron(piloto)) throw ApiError.badRequest(`${nombreColaborador(piloto)} no tiene el cargo «${CARGO_PILOTO_DRON}»`);
    }
  } else {
    const p = actuales.find((x) => x.rol === 'PILOTO');
    piloto = p ? await Colaborador.findByPk(p.colaboradorId, { transaction }) : null;
  }
  let asistentesIds;
  if (datos.asistentesUuids !== undefined) {
    asistentesIds = [];
    for (const uuid of [...new Set(datos.asistentesUuids || [])]) {
      const a = await colaboradorActivoOFallar(uuid, { transaction });
      if (piloto && a.id === piloto.id) continue; // el piloto no se cuenta dos veces
      asistentesIds.push(a.id);
    }
  } else {
    asistentesIds = actuales.filter((x) => x.rol === 'ASISTENTE' && (!piloto || x.colaboradorId !== piloto.id)).map((x) => x.colaboradorId);
  }
  await ComprobanteAspersionParticipante.destroy({ where: { comprobanteId: comprobante.id }, transaction });
  const filas = [
    ...(piloto ? [{ comprobanteId: comprobante.id, colaboradorId: piloto.id, rol: 'PILOTO', createdBy: actorId }] : []),
    ...asistentesIds.map((id) => ({ comprobanteId: comprobante.id, colaboradorId: id, rol: 'ASISTENTE', createdBy: actorId })),
  ];
  if (filas.length) await ComprobanteAspersionParticipante.bulkCreate(filas, { transaction });
  return { pilotoColaboradorId: piloto?.id ?? null, ...(piloto ? { piloto: nombreColaborador(piloto) } : {}) };
}

// articuloId del insumo principal de la receta ACTIVA de cada mezcla — el
// comprobante lista los insumos con el principal primero (mismo orden que
// toda la API, ver utils/ordenReceta.js).
async function mapaPrincipales(mezclaIds) {
  const ids = [...new Set(mezclaIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const versiones = await MezclaVersion.findAll({
    where: { mezclaId: ids, activa: true },
    include: [{ model: MezclaComponente, as: 'componentes', where: { esPrincipal: true }, required: false, attributes: ['articuloId'] }],
  });
  return new Map(versiones.map((v) => [v.mezclaId, v.componentes?.[0]?.articuloId ?? null]));
}

// El PDF del comprobante muestra solo los NOMBRES de los insumos (pedido explícito); el detalle en pantalla también muestra
// las cantidades definitivas: `cantidad` (lo que se descontó del inventario al ejecutar).
// `aspersion.componentes` no sale en la respuesta; solo `insumos`.
// `puedeRegenerar`: el comprobante está anulado y su aspersión no tiene otro vigente, así que se puede crear un borrador
// nuevo con los mismos datos de la aplicación (ver regenerar()).
function aDto(comprobante, principalArticuloId, { puedeRegenerar = false } = {}) {
  const json = comprobante.toJSON();
  const componentes = json.aspersion?.componentes || [];
  json.insumos = ordenarComponentesReceta(componentes, principalArticuloId).map((c) => ({
    nombre: c.articulo?.nombre || '—',
    codigo: c.articulo?.codigo || null,
    esPrincipal: principalArticuloId !== null && principalArticuloId !== undefined && c.articuloId === principalArticuloId,
    cantidad: c.cantidad !== null && c.cantidad !== undefined ? Number(c.cantidad) : null,
    esAdicional: Boolean(c.esAdicional),
    unidad: c.unidad ? { nombre: c.unidad.nombre, simbolo: c.unidad.simbolo } : null,
  }));
  if (json.aspersion) delete json.aspersion.componentes;
  json.puedeRegenerar = Boolean(puedeRegenerar);
  json.pilotoColaborador = json.pilotoColaborador ? { uuid: json.pilotoColaborador.uuid, nombre: nombreColaborador(json.pilotoColaborador) } : null;
  if (Array.isArray(json.participantes)) {
    json.participantes = json.participantes
      .filter((p) => p.colaborador)
      .sort((a, b) => (a.rol === b.rol ? 0 : a.rol === 'PILOTO' ? -1 : 1))
      .map((p) => ({ rol: p.rol, colaborador: { uuid: p.colaborador.uuid, nombre: nombreColaborador(p.colaborador), cargo: p.colaborador.cargo || null } }));
  }
  return json;
}

async function cargarOFallar(uuid, user) {
  const comprobante = await comprobanteAspersionRepository.findByUuid(uuid);
  if (!comprobante) throw ApiError.notFound('Comprobante de aspersión no encontrado');
  const permitidos = getAlmacenIdsPermitidas(user);
  if (permitidos !== null && !permitidos.includes(comprobante.aspersion?.almacenId)) {
    throw ApiError.notFound('Comprobante de aspersión no encontrado');
  }
  return comprobante;
}

function assertBorrador(comprobante) {
  if (comprobante.estado !== 'BORRADOR') {
    throw ApiError.badRequest(
      comprobante.estado === 'ANULADO' ? 'Un comprobante anulado no se puede modificar' : 'Un comprobante ya emitido no se puede modificar',
    );
  }
}

// Galones totales de la mezcla: la "cantidad a preparar" de la aspersión
// (en la unidad de rendimiento de la mezcla) llevada a Galones. Null si no
// hay conversión — se completa a mano en el comprobante.
async function galonesDeAspersion(aspersion, { transaction } = {}) {
  const unidadId = aspersion.mezcla?.unidadRendimientoId;
  if (!unidadId) return null;
  const galon = await UnidadMedida.findOne({ where: { nombre: 'Galón' }, transaction });
  if (!galon) return null;
  const factor = await resolverFactorConversion(unidadId, galon.id, { transaction });
  if (factor === null) return null;
  return Math.round(Number(aspersion.cantidadCalculada) * factor * 100) / 100;
}

// Volumen de aplicación por hectárea: la DOSIS CONFIGURADA de la mezcla llevada a galones por hectárea (sin el aumento de la
// programación: si la mezcla es de 6 gal/ha y se programó con 8 % de aumento, queda 6 gal/ha). Null si no hay dosis o conversión.
async function volumenConfiguradoGalHa(aspersion, { transaction } = {}) {
  const dosis = Number(aspersion.mezcla?.dosisPorHectarea);
  const unidadId = aspersion.mezcla?.dosisPorHectareaUnidadId || aspersion.mezcla?.unidadRendimientoId;
  if (!(dosis > 0) || !unidadId) return null;
  const galon = await UnidadMedida.findOne({ where: { nombre: 'Galón' }, transaction });
  if (!galon) return null;
  const factor = await resolverFactorConversion(unidadId, galon.id, { transaction });
  return factor === null ? null : Math.round(dosis * factor * 100) / 100;
}

// Texto por defecto de las observaciones de un comprobante nuevo.
export const OBSERVACION_COMPROBANTE_DEFECTO =
  'Cuatro horas después de finalizada la aspersión, una vez cumplido el periodo de reentrada, se recorrió el área de la finca y se observó un buen cubrimiento de la mezcla asperjada.';

// Datos de la aplicación que se copian tal cual al regenerar un borrador desde
// un comprobante anulado (la aspersión ya se ejecutó y no se vuelve a ejecutar).
const CAMPOS_APLICACION = [
  'medio',
  'piloto',
  'hectareasProgramadas',
  'hectareasAplicadas',
  'galonesTotales',
  'observaciones',
  'aeronave',
  'temperaturaInicial',
  'temperaturaFinal',
  'velocidadViento',
  'humedadRelativaFinal',
  'horaInicio',
  'horaFinal',
  'volumenAplicacionHa',
  'ejecutadoPorId',
  'ejecutadoEn',
];

export const comprobanteAspersionService = {
  // Se llama desde aspersionProgramacion.service.js#ejecutar, dentro de la
  // MISMA transacción: ejecutar la aspersión y crear su comprobante en
  // BORRADOR son una sola operación. `datos` viene del modal de ejecutar
  // (piloto, hectáreas aplicadas, galones, observaciones) y es opcional.
  async crearBorradorDesdeEjecucion(aspersion, datos, actorId, { transaction } = {}) {
    const existente = await comprobanteAspersionRepository.activeForAspersion(aspersion.id, { transaction });
    if (existente) return existente;

    const galonesAuto = await galonesDeAspersion(aspersion, { transaction });
    const numero = await generarCorrelativo(ComprobanteAspersion, { prefijo: PREFIJO, columna: 'numero', transaction });
    const creado = await comprobanteAspersionRepository.create(
      {
        numero,
        aspersionProgramacionId: aspersion.id,
        estado: 'BORRADOR',
        medio: aspersion.medio || null,
        piloto: datos?.piloto?.trim() || null,
        hectareasProgramadas: aspersion.hectareas,
        hectareasAplicadas: datos?.hectareasAplicadas ?? aspersion.hectareas,
        galonesTotales: datos?.galonesTotales ?? galonesAuto,
        observaciones: datos?.observaciones?.trim() || OBSERVACION_COMPROBANTE_DEFECTO,
        aeronave: datos?.aeronave?.trim() || null,
        temperaturaInicial: datos?.temperaturaInicial ?? null,
        temperaturaFinal: datos?.temperaturaFinal ?? null,
        velocidadViento: datos?.velocidadViento ?? null,
        humedadRelativaFinal: datos?.humedadRelativaFinal ?? null,
        horaInicio: datos?.horaInicio || null,
        horaFinal: datos?.horaFinal || null,
        volumenAplicacionHa: datos?.volumenAplicacionHa ?? (await volumenConfiguradoGalHa(aspersion, { transaction })),
        ejecutadoPorId: actorId,
        ejecutadoEn: new Date(),
        createdBy: actorId,
      },
      { transaction },
    );
    // Con dron: piloto (del listado) y asistentes.
    const extra = await aplicarParticipantes(
      creado,
      creado.medio,
      { pilotoColaboradorUuid: datos?.pilotoColaboradorUuid ?? undefined, asistentesUuids: datos?.asistentesUuids ?? undefined },
      actorId,
      { transaction },
    );
    if (Object.keys(extra).length) await creado.update(extra, { transaction });
    return creado;
  },

  async list(query, user) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await comprobanteAspersionRepository.findAndCountAll({
      limit,
      offset,
      estado: query.estado,
      fincaUuid: query.fincaUuid,
      semanaUuid: query.semanaUuid,
      search: query.search,
      fechaDesde: query.fechaDesde,
      fechaHasta: query.fechaHasta,
      almacenIdsPermitidos: getAlmacenIdsPermitidas(user),
    });
    const principales = await mapaPrincipales(rows.map((r) => r.aspersion?.mezcla?.id));
    // Un anulado se puede regenerar mientras su aspersión no tenga comprobante vigente.
    const conVigente = await comprobanteAspersionRepository.findActiveAspersionIds(
      rows.filter((r) => r.estado === 'ANULADO').map((r) => r.aspersionProgramacionId),
    );
    const items = rows.map((r) =>
      aDto(r, principales.get(r.aspersion?.mezcla?.id) ?? null, {
        puedeRegenerar: r.estado === 'ANULADO' && !conVigente.has(r.aspersionProgramacionId),
      }),
    );
    return { items, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getByUuid(uuid, user) {
    const comprobante = await cargarOFallar(uuid, user);
    const principales = await mapaPrincipales([comprobante.aspersion?.mezclaId]);
    let puedeRegenerar = false;
    if (comprobante.estado === 'ANULADO') {
      const vigente = await comprobanteAspersionRepository.activeForAspersion(comprobante.aspersionProgramacionId);
      puedeRegenerar = !vigente;
    }
    return aDto(comprobante, principales.get(comprobante.aspersion?.mezclaId) ?? null, { puedeRegenerar });
  },

  async update(uuid, payload, actorId, user) {
    const comprobante = await cargarOFallar(uuid, user);
    assertBorrador(comprobante);

    const data = { updatedBy: actorId };
    if (payload.piloto !== undefined) data.piloto = payload.piloto?.trim() || null;
    if (payload.medio !== undefined) data.medio = payload.medio || null;
    // Los datos de la ejecución (hectáreas, galones, aeronave, clima y horario) no se editan en el borrador.
    if (payload.observaciones !== undefined) data.observaciones = payload.observaciones?.trim() || null;

    await sequelize.transaction(async (transaction) => {
      const medio = data.medio !== undefined ? data.medio : comprobante.medio;
      const extra = await aplicarParticipantes(
        comprobante,
        medio,
        { pilotoColaboradorUuid: payload.pilotoColaboradorUuid, asistentesUuids: payload.asistentesUuids },
        actorId,
        { transaction },
      );
      await comprobanteAspersionRepository.update(comprobante, { ...data, ...extra }, { transaction });
    });
    return this.getByUuid(uuid, user);
  },

  async emitir(uuid, actorId, user) {
    const comprobante = await cargarOFallar(uuid, user);
    assertBorrador(comprobante);
    if (!comprobante.piloto?.trim() || !(Number(comprobante.hectareasAplicadas) > 0)) {
      throw ApiError.badRequest('Completa el piloto y las hectáreas aplicadas antes de emitir el comprobante');
    }
    // El recorrido (KML/KMZ) es obligatorio para aprobar: su mapa va en el PDF y el KMZ en el correo.
    if (!comprobante.kmlNombre) {
      throw ApiError.badRequest('Sube el recorrido (KML o KMZ) antes de aprobar el comprobante');
    }
    if (comprobante.medio === 'DRON' && !comprobante.pilotoColaboradorId) {
      throw ApiError.badRequest('Con dron, elige el piloto del listado de colaboradores antes de emitir el comprobante');
    }
    await comprobanteAspersionRepository.update(comprobante, {
      estado: 'EMITIDO',
      emitidoPorId: actorId,
      emitidoEn: new Date(),
      updatedBy: actorId,
    });
    return this.getByUuid(uuid, user);
  },

  // Recorrido (KML) del borrador: el archivo original y la geometría simplificada que calculó el navegador ({ lineas, poligonos,
  // puntos } en [lat, lng]). Su mapa sale en la segunda hoja del PDF.
  async subirKml(uuid, archivo, geometriaTexto, actorId, user) {
    const comprobante = await cargarOFallar(uuid, user);
    assertBorrador(comprobante);
    if (!archivo?.buffer?.length) throw ApiError.badRequest('Adjunta el archivo KML del recorrido');
    const texto = archivo.buffer.toString('utf8');
    if (!/<kml[\s>]/i.test(texto)) throw ApiError.badRequest('El archivo no es un KML válido');
    let geometria;
    try {
      geometria = JSON.parse(geometriaTexto || '{}');
    } catch {
      throw ApiError.badRequest('La geometría del recorrido no es válida');
    }
    const valido = (l) => Array.isArray(l) && l.every((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));
    const limpia = {
      lineas: (geometria.lineas || []).filter(valido).slice(0, 200),
      poligonos: (geometria.poligonos || []).filter(valido).slice(0, 200),
      puntos: (Array.isArray(geometria.puntos) ? geometria.puntos : []).filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])).slice(0, 500),
    };
    if (!limpia.lineas.length && !limpia.poligonos.length && !limpia.puntos.length) {
      throw ApiError.badRequest('El KML no tiene recorridos, polígonos ni puntos');
    }
    await comprobanteAspersionRepository.update(comprobante, {
      kml: texto,
      kmlNombre: String(archivo.originalname || 'recorrido.kml').slice(0, 200),
      kmlGeometria: limpia,
      kmlSubidoEn: new Date(),
      updatedBy: actorId,
    });
    return this.getByUuid(uuid, user);
  },

  async quitarKml(uuid, actorId, user) {
    const comprobante = await cargarOFallar(uuid, user);
    assertBorrador(comprobante);
    await comprobanteAspersionRepository.update(comprobante, { kml: null, kmlNombre: null, kmlGeometria: null, kmlSubidoEn: null, updatedBy: actorId });
    return this.getByUuid(uuid, user);
  },

  // Envía el comprobante YA EMITIDO por correo: el PDF (con el mapa) y el KMZ del recorrido, a los destinatarios configurados para
  // la finca (Configuración → Programación de Aspersiones: roles de la finca, usuarios en copia y correos externos).
  async enviarCorreo(uuid, { pdfBuffer, pdfNombre, kmzBuffer, kmzNombre }, actorId, user) {
    const comprobante = await cargarOFallar(uuid, user);
    if (comprobante.estado !== 'EMITIDO') throw ApiError.badRequest('Primero aprueba (emite) el comprobante; después se envía');
    if (!pdfBuffer?.length) throw ApiError.badRequest('Falta el PDF del comprobante');
    const { aspersionProgramacionService } = await import('./aspersionProgramacion.service.js');
    const destinatarios = await aspersionProgramacionService.resolverDestinatariosConfigurados(comprobante.aspersion?.fincaId);
    if (!destinatarios.length) throw ApiError.badRequest('No hay destinatarios configurados para la finca (Programación de Aspersiones → engranaje)');
    await mailService.sendComprobanteAspersion({
      destinatarios,
      numero: comprobante.numero,
      fincaNombre: comprobante.aspersion?.finca?.nombre || '',
      fechaEjecucion: comprobante.ejecutadoEn ? new Date(new Date(comprobante.ejecutadoEn).getTime() - 5 * 3600 * 1000).toISOString().slice(0, 10) : null,
      mezclaNombre: comprobante.aspersion?.mezcla?.nombre || comprobante.aspersion?.mezcla?.codigo || '',
      hectareas: comprobante.hectareasAplicadas,
      pdfBuffer,
      pdfNombre,
      kmzBuffer,
      kmzNombre,
    });
    await comprobanteAspersionRepository.update(comprobante, { correoEnviadoEn: new Date(), correoEnviadoPorId: actorId });
    return this.getByUuid(uuid, user);
  },

  // Archivo KML original, para descargarlo.
  async descargarKml(uuid, user) {
    await cargarOFallar(uuid, user);
    const c = await ComprobanteAspersion.findOne({ where: { uuid }, attributes: ['numero', 'kml', 'kmlNombre'] });
    if (!c?.kml) throw ApiError.notFound('Este comprobante no tiene KML');
    return { texto: c.kml, nombre: c.kmlNombre || `${c.numero}.kml` };
  },

  // Pilotos (colaboradores activos con cargo «Piloto de Dron») y asistentes (colaboradores activos) para elegir.
  async participantesDisponibles() {
    const activos = await Colaborador.findAll({
      where: { estado: true },
      attributes: ['uuid', 'nombre', 'apellido', 'cargo', 'documento', 'modulo'],
      order: [['nombre', 'ASC'], ['apellido', 'ASC']],
    });
    const mapa = (c) => ({ uuid: c.uuid, nombre: nombreColaborador(c), cargo: c.cargo || null, documento: c.documento || null });
    return { pilotos: activos.filter(esPilotoDeDron).map(mapa), asistentes: activos.map(mapa) };
  },

  // Hectáreas asperjadas por colaborador: cada participante (piloto o asistente) suma las hectáreas aplicadas del comprobante.
  // Sin anulados. Por día de ejecución (hora de Bogotá).
  async reporteHectareas(query, user) {
    const diaBogota = (d) => new Date(new Date(d).getTime() - 5 * 3600 * 1000).toISOString().slice(0, 10);
    const desde = query.desde ? new Date(`${String(query.desde).slice(0, 10)}T00:00:00-05:00`) : null;
    const hasta = query.hasta ? new Date(`${String(query.hasta).slice(0, 10)}T23:59:59.999-05:00`) : null;
    const whereComp = { estado: query.soloEmitidos === true || query.soloEmitidos === 'true' ? 'EMITIDO' : { [Op.ne]: 'ANULADO' } };
    if (desde || hasta) whereComp.ejecutadoEn = { ...(desde ? { [Op.gte]: desde } : {}), ...(hasta ? { [Op.lte]: hasta } : {}) };
    const whereColab = {};
    if (query.colaboradorUuid) whereColab.uuid = query.colaboradorUuid;
    if (query.cargoUuid) {
      const cargo = await Cargo.findOne({ where: { uuid: query.cargoUuid }, attributes: ['id'] });
      whereColab.cargoId = cargo?.id ?? -1;
    }
    const permitidos = getAlmacenIdsPermitidas(user);
    const filas = await ComprobanteAspersionParticipante.findAll({
      include: [
        {
          model: ComprobanteAspersion,
          as: 'comprobante',
          required: true,
          where: whereComp,
          attributes: ['uuid', 'numero', 'estado', 'hectareasAplicadas', 'ejecutadoEn'],
          include: [
            {
              model: AspersionProgramacion,
              as: 'aspersion',
              required: true,
              where: permitidos !== null ? { almacenId: { [Op.in]: permitidos } } : undefined,
              attributes: ['uuid', 'numero'],
              include: [{ model: Finca, as: 'finca', attributes: ['uuid', 'nombre'] }],
            },
          ],
        },
        { model: Colaborador, as: 'colaborador', required: true, where: whereColab, attributes: ['uuid', 'nombre', 'apellido', 'cargo'], paranoid: false },
      ],
    });
    const r2 = (n) => Math.round(n * 100) / 100;
    const detalle = filas
      .map((p) => ({
        fecha: diaBogota(p.comprobante.ejecutadoEn),
        colaborador: { uuid: p.colaborador.uuid, nombre: nombreColaborador(p.colaborador) },
        cargo: p.colaborador.cargo || 'Sin cargo',
        rol: p.rol,
        finca: p.comprobante.aspersion?.finca?.nombre || '—',
        aspersion: p.comprobante.aspersion?.numero || '—',
        comprobante: p.comprobante.numero,
        estado: p.comprobante.estado,
        hectareas: Number(p.comprobante.hectareasAplicadas) || 0,
      }))
      .sort((a, b) => (a.fecha === b.fecha ? a.colaborador.nombre.localeCompare(b.colaborador.nombre, 'es') : a.fecha < b.fecha ? 1 : -1));
    const sumar = (clave) => {
      const m = new Map();
      for (const d of detalle) {
        const k = clave(d);
        const x = m.get(k.id) || { ...k, hectareas: 0, aplicaciones: 0 };
        x.hectareas += d.hectareas;
        x.aplicaciones += 1;
        m.set(k.id, x);
      }
      return [...m.values()].map((x) => ({ ...x, hectareas: r2(x.hectareas) })).sort((a, b) => b.hectareas - a.hectareas);
    };
    return {
      detalle,
      porDia: sumar((d) => ({ id: `${d.fecha}|${d.colaborador.uuid}`, fecha: d.fecha, colaborador: d.colaborador, cargo: d.cargo })).sort((a, b) =>
        a.fecha === b.fecha ? a.colaborador.nombre.localeCompare(b.colaborador.nombre, 'es') : a.fecha < b.fecha ? 1 : -1,
      ),
      porColaborador: sumar((d) => ({ id: d.colaborador.uuid, colaborador: d.colaborador, cargo: d.cargo })),
      porCargo: sumar((d) => ({ id: d.cargo, cargo: d.cargo })),
      total: r2(detalle.reduce((s, d) => s + d.hectareas, 0)),
    };
  },

  // Anular reemplaza al borrado: el comprobante queda como registro histórico
  // (con el motivo y quién lo anuló) y la aspersión deja de tener documento
  // vigente, así que se puede regenerar uno nuevo desde este mismo.
  async anular(uuid, { motivo }, actorId, user) {
    const comprobante = await cargarOFallar(uuid, user);
    if (comprobante.estado === 'ANULADO') {
      throw ApiError.badRequest('El comprobante ya está anulado');
    }

    await comprobanteAspersionRepository.update(comprobante, {
      estado: 'ANULADO',
      motivoAnulacion: motivo.trim(),
      anuladoPorId: actorId,
      anuladoEn: new Date(),
      updatedBy: actorId,
    });
    return this.getByUuid(uuid, user);
  },

  // Crea un BORRADOR nuevo con los mismos datos de la aplicación del comprobante
  // anulado. La aspersión no se vuelve a ejecutar ni se descuenta inventario:
  // solo se recupera el documento que el borrado anterior dejaba sin forma de
  // reconstruir (y que las alertas FRAC usan para la aeronave).
  async regenerar(uuid, actorId, user) {
    const anulado = await cargarOFallar(uuid, user);
    if (anulado.estado !== 'ANULADO') {
      throw ApiError.badRequest('Solo se puede regenerar un borrador desde un comprobante anulado');
    }

    const nuevoUuid = await sequelize.transaction(async (transaction) => {
      // Bloquea el comprobante anulado: dos regeneraciones simultáneas del mismo
      // documento se serializan y la segunda ve el vigente que creó la primera.
      await ComprobanteAspersion.findByPk(anulado.id, { transaction, lock: transaction.LOCK.UPDATE });

      const vigente = await comprobanteAspersionRepository.activeForAspersion(anulado.aspersionProgramacionId, { transaction });
      if (vigente) {
        throw ApiError.conflict(
          `Esta aspersión ya tiene un comprobante vigente (${vigente.numero}); anúlalo antes de regenerar otro borrador`,
        );
      }

      const numero = await generarCorrelativo(ComprobanteAspersion, { prefijo: PREFIJO, columna: 'numero', transaction });
      const datos = { numero, aspersionProgramacionId: anulado.aspersionProgramacionId, estado: 'BORRADOR', createdBy: actorId };
      for (const campo of CAMPOS_APLICACION) datos[campo] = anulado[campo];

      datos.pilotoColaboradorId = anulado.pilotoColaboradorId;
      // El recorrido (KML) también pasa al borrador nuevo.
      const conKml = await ComprobanteAspersion.findByPk(anulado.id, { attributes: ['kml', 'kmlNombre', 'kmlGeometria', 'kmlSubidoEn'], transaction });
      Object.assign(datos, { kml: conKml.kml, kmlNombre: conKml.kmlNombre, kmlGeometria: conKml.kmlGeometria, kmlSubidoEn: conKml.kmlSubidoEn });
      const creado = await comprobanteAspersionRepository.create(datos, { transaction });
      // El piloto y los asistentes pasan al borrador nuevo.
      const participantes = await ComprobanteAspersionParticipante.findAll({ where: { comprobanteId: anulado.id }, transaction });
      if (participantes.length) {
        await ComprobanteAspersionParticipante.bulkCreate(
          participantes.map((p) => ({ comprobanteId: creado.id, colaboradorId: p.colaboradorId, rol: p.rol, createdBy: actorId })),
          { transaction },
        );
      }
      return creado.uuid;
    });

    return this.getByUuid(nuevoUuid, user);
  },
};

export default comprobanteAspersionService;
