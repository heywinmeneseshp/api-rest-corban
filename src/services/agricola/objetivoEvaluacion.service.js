import { TipoEvaluacion, Finca, Lote, Semana } from '../../database/associations.js';
import { objetivoEvaluacionRepository } from '../../repositories/agricola/objetivoEvaluacion.repository.js';
import { evaluacionRepository } from '../../repositories/agricola/evaluacion.repository.js';
import { semanaRepository } from '../../repositories/agricola/semana.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { assertFincaPermitida } from '../../utils/fincaScope.js';
import { semanasEntre } from '../../utils/edadPlanta.js';

const CONTEO_HOJAS_NOMBRE = 'Conteo de Hojas';

const findTipoEvaluacionByUuidOrFail = async (uuid) => {
  const tipo = await TipoEvaluacion.findOne({ where: { uuid } });
  if (!tipo) throw ApiError.notFound('Tipo de evaluación no encontrado');
  return tipo;
};

const findFincaByUuidOrFail = async (uuid) => {
  const finca = await Finca.findOne({ where: { uuid } });
  if (!finca) throw ApiError.notFound('Finca no encontrada');
  return finca;
};

const findLoteByUuidOrFail = async (uuid) => {
  const lote = await Lote.findOne({ where: { uuid } });
  if (!lote) throw ApiError.notFound('Lote no encontrado');
  return lote;
};

// Valida que venga exactamente uno de fincaUuid/loteUuid, resuelve sus ids
// y limpia edadMinima/edadMaxima si el tipo no es "Conteo de Hojas".
const resolverAmbitoYEdad = async (payload, tipoEvaluacion) => {
  if (Boolean(payload.fincaUuid) === Boolean(payload.loteUuid)) {
    throw ApiError.badRequest('Debes indicar exactamente una finca o un lote, no ambos ni ninguno');
  }
  const fincaId = payload.fincaUuid ? (await findFincaByUuidOrFail(payload.fincaUuid)).id : null;
  const loteId = payload.loteUuid ? (await findLoteByUuidOrFail(payload.loteUuid)).id : null;

  const esConteoHojas = tipoEvaluacion.nombre === CONTEO_HOJAS_NOMBRE;
  const edadMinima = esConteoHojas ? payload.edadMinima ?? null : null;
  const edadMaxima = esConteoHojas ? payload.edadMaxima ?? null : null;
  if (edadMinima !== null && edadMaxima !== null && edadMinima > edadMaxima) {
    throw ApiError.badRequest('La edad mínima no puede ser mayor que la edad máxima');
  }

  return { fincaId, loteId, edadMinima, edadMaxima };
};

// Edad (semanas desde embolse) de una evaluación de Conteo de Hojas, o
// null si no se puede calcular (falta semanaEmbolse o semana).
const edadDe = (ev) => {
  const embolse = ev.conteoHojas?.semanaEmbolse;
  if (!embolse || !ev.semana) return null;
  return semanasEntre(embolse.fechaInicio, ev.semana.fechaInicio);
};

// Progreso de un objetivo dentro de un conjunto de evaluaciones ya traído
// por evaluacionRepository.findAllPorSemana. Cuando el objetivo tiene un
// rango de edad completo (edadMinima Y edadMaxima), la `cantidad` es la
// meta POR CADA edad del rango por separado (no un total combinado) — se
// evalúa cada semana de edad como si fuera su propio objetivo y se suman
// los resultados, devolviendo también el detalle por edad.
const construirProgreso = (evaluaciones, objetivo) => {
  const evsTipo = evaluaciones.filter((ev) => ev.tipoEvaluacion?.nombre === objetivo.tipoEvaluacion?.nombre);

  if (objetivo.edadMinima !== null && objetivo.edadMaxima !== null) {
    const detalleEdades = [];
    let realizadas = 0;
    let faltan = 0;
    for (let edad = objetivo.edadMinima; edad <= objetivo.edadMaxima; edad += 1) {
      const realizadasEdad = evsTipo.filter((ev) => edadDe(ev) === edad).length;
      const faltanEdad = Math.max(0, objetivo.cantidad - realizadasEdad);
      detalleEdades.push({ edad, cantidad: objetivo.cantidad, realizadas: realizadasEdad, faltan: faltanEdad });
      realizadas += realizadasEdad;
      faltan += faltanEdad;
    }
    return { realizadas, faltan, detalleEdades };
  }

  // Sin rango de edad completo (ninguno de los dos extremos, o un tipo
  // distinto a Conteo de Hojas): conteo combinado simple contra `cantidad`.
  let n = 0;
  for (const ev of evsTipo) {
    if (objetivo.edadMinima !== null || objetivo.edadMaxima !== null) {
      const edad = edadDe(ev);
      if (edad === null) continue;
      if (objetivo.edadMinima !== null && edad < objetivo.edadMinima) continue;
      if (objetivo.edadMaxima !== null && edad > objetivo.edadMaxima) continue;
    }
    n += 1;
  }
  return { realizadas: n, faltan: Math.max(0, objetivo.cantidad - n), detalleEdades: null };
};

export const objetivoEvaluacionService = {
  async listObjetivos(query) {
    const { page, limit, offset } = getPagination(query);
    const fincaId = query.fincaUuid ? (await findFincaByUuidOrFail(query.fincaUuid)).id : undefined;
    const loteId = query.loteUuid ? (await findLoteByUuidOrFail(query.loteUuid)).id : undefined;
    const tipoEvaluacionId = query.tipoEvaluacionUuid
      ? (await findTipoEvaluacionByUuidOrFail(query.tipoEvaluacionUuid)).id
      : undefined;

    const { rows, count } = await objetivoEvaluacionRepository.findAndCountAll({
      limit,
      offset,
      fincaId,
      loteId,
      tipoEvaluacionId,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getObjetivoByUuid(uuid) {
    const objetivo = await objetivoEvaluacionRepository.findByUuid(uuid);
    if (!objetivo) throw ApiError.notFound('Objetivo no encontrado');
    return objetivo;
  },

  async createObjetivo(payload, actorId) {
    const tipoEvaluacion = await findTipoEvaluacionByUuidOrFail(payload.tipoEvaluacionUuid);
    const { fincaId, loteId, edadMinima, edadMaxima } = await resolverAmbitoYEdad(payload, tipoEvaluacion);

    return objetivoEvaluacionRepository.create({
      tipoEvaluacionId: tipoEvaluacion.id,
      fincaId,
      loteId,
      cantidad: payload.cantidad,
      edadMinima,
      edadMaxima,
      estado: payload.estado ?? true,
      createdBy: actorId,
    });
  },

  async updateObjetivo(uuid, payload, actorId) {
    const objetivo = await this.getObjetivoByUuid(uuid);
    const data = { updatedBy: actorId };

    const tipoEvaluacionUuid = payload.tipoEvaluacionUuid;
    const tipoEvaluacion = tipoEvaluacionUuid
      ? await findTipoEvaluacionByUuidOrFail(tipoEvaluacionUuid)
      : objetivo.tipoEvaluacion;
    if (tipoEvaluacionUuid) data.tipoEvaluacionId = tipoEvaluacion.id;

    if (payload.fincaUuid !== undefined || payload.loteUuid !== undefined) {
      const { fincaId, loteId, edadMinima, edadMaxima } = await resolverAmbitoYEdad(
        {
          fincaUuid: payload.fincaUuid,
          loteUuid: payload.loteUuid,
          edadMinima: payload.edadMinima,
          edadMaxima: payload.edadMaxima,
        },
        tipoEvaluacion,
      );
      data.fincaId = fincaId;
      data.loteId = loteId;
      data.edadMinima = edadMinima;
      data.edadMaxima = edadMaxima;
    } else if (payload.edadMinima !== undefined || payload.edadMaxima !== undefined) {
      const esConteoHojas = tipoEvaluacion.nombre === CONTEO_HOJAS_NOMBRE;
      data.edadMinima = esConteoHojas ? payload.edadMinima ?? null : null;
      data.edadMaxima = esConteoHojas ? payload.edadMaxima ?? null : null;
      if (data.edadMinima !== null && data.edadMaxima !== null && data.edadMinima > data.edadMaxima) {
        throw ApiError.badRequest('La edad mínima no puede ser mayor que la edad máxima');
      }
    }

    if (payload.cantidad !== undefined) data.cantidad = payload.cantidad;
    if (payload.estado !== undefined) data.estado = payload.estado;

    return objetivoEvaluacionRepository.update(objetivo, data);
  },

  async deleteObjetivo(uuid, actorId) {
    const objetivo = await this.getObjetivoByUuid(uuid);
    await objetivoEvaluacionRepository.softDelete(objetivo, actorId);
  },

  // Progreso de los objetivos aplicables a una finca y/o un lote, para la
  // semana indicada (o la semana abierta actual si no llega ninguna) — lo
  // consulta la app móvil justo después de sincronizar.
  async progreso(query, user) {
    const finca = query.fincaUuid ? await findFincaByUuidOrFail(query.fincaUuid) : null;
    if (finca) assertFincaPermitida(user, finca.id);
    const lote = query.loteUuid ? await findLoteByUuidOrFail(query.loteUuid) : null;
    if (lote) assertFincaPermitida(user, lote.fincaId);

    const semana = query.semanaUuid
      ? await Semana.findOne({ where: { uuid: query.semanaUuid } })
      : await semanaRepository.findByFecha(new Date().toISOString().slice(0, 10));
    if (!semana) return { semana: null, objetivos: [] };

    const objetivos = await objetivoEvaluacionRepository.findAplicables({
      fincaId: finca?.id,
      loteId: lote?.id,
    });
    if (objetivos.length === 0) {
      return {
        semana: { uuid: semana.uuid, codigo: semana.codigo, numeroSemana: semana.numeroSemana, anio: semana.anio },
        objetivos: [],
      };
    }

    const necesitaFinca = objetivos.some((o) => o.fincaId);
    const necesitaLote = objetivos.some((o) => o.loteId);

    const evsFinca = necesitaFinca
      ? await evaluacionRepository.findAllPorSemana({ fincaIds: [finca.id], semanaId: semana.id })
      : [];
    const evsLote = necesitaLote
      ? await evaluacionRepository.findAllPorSemana({ loteId: lote.id, semanaId: semana.id })
      : [];

    const resultado = objetivos.map((o) => {
      const { realizadas, faltan, detalleEdades } = construirProgreso(o.fincaId ? evsFinca : evsLote, o);
      return {
        uuid: o.uuid,
        tipoNombre: o.tipoEvaluacion?.nombre,
        alcance: o.fincaId ? 'finca' : 'lote',
        nombreAmbito: o.fincaId ? o.finca?.nombre : o.lote?.nombre,
        cantidad: o.cantidad,
        edadMinima: o.edadMinima,
        edadMaxima: o.edadMaxima,
        realizadas,
        faltan,
        detalleEdades,
      };
    });

    return {
      semana: { uuid: semana.uuid, codigo: semana.codigo, numeroSemana: semana.numeroSemana, anio: semana.anio },
      objetivos: resultado,
    };
  },
};

export default objetivoEvaluacionService;
