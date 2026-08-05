import { sequelize } from '../../database/connection.js';
import { Planta, User, TipoEvaluacion, Semana, Finca, Lote } from '../../database/associations.js';
import { evaluacionRepository } from '../../repositories/agricola/evaluacion.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { getFincaIdsPermitidas, assertFincaPermitida } from '../../utils/fincaScope.js';
import { adjuntarTotales } from './sumaBrutaTotal.js';

// Semanas de diferencia entre dos fechas de inicio de semana (mismo sistema
// ISO). Devuelve null si alguna fecha es inválida.
function semanasEntre(fechaInicioA, fechaInicioB) {
  const a = Date.parse(fechaInicioA);
  const b = Date.parse(fechaInicioB);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / (7 * 24 * 60 * 60 * 1000));
}

// Trae la planta con su loteId para poder validar la finca del usuario sin
// otra consulta.
const findPlantaConLoteByUuidOrFail = async (uuid) => {
  const planta = await Planta.findOne({ where: { uuid }, include: [{ model: Lote, as: 'lote', attributes: ['id', 'fincaId'] }] });
  if (!planta) throw ApiError.notFound('Planta no encontrada');
  return planta;
};

const findTipoEvaluacionByUuidOrFail = async (uuid) => {
  const tipo = await TipoEvaluacion.findOne({ where: { uuid } });
  if (!tipo) throw ApiError.notFound('Tipo de evaluación no encontrado');
  return tipo;
};

const findSemanaByUuidOrFail = async (uuid) => {
  const semana = await Semana.findOne({ where: { uuid } });
  if (!semana) throw ApiError.notFound('Semana no encontrada');
  return semana;
};

const findUsuarioByUuidOrFail = async (uuid) => {
  const usuario = await User.findOne({ where: { uuid } });
  if (!usuario) throw ApiError.notFound('Usuario evaluador no encontrado');
  return usuario;
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

export const evaluacionService = {
  async listEvaluaciones(query, user) {
    const { page, limit, offset } = getPagination(query);

    const fincaId = query.fincaUuid ? (await findFincaByUuidOrFail(query.fincaUuid)).id : undefined;
    if (fincaId) assertFincaPermitida(user, fincaId);
    const loteId = query.loteUuid ? (await findLoteByUuidOrFail(query.loteUuid)).id : undefined;
    const tipoEvaluacionId = query.tipoEvaluacionUuid
      ? (await findTipoEvaluacionByUuidOrFail(query.tipoEvaluacionUuid)).id
      : undefined;

    const { rows, count } = await evaluacionRepository.findAndCountAll({
      limit,
      offset,
      fechaDesde: query.fechaDesde,
      fechaHasta: query.fechaHasta,
      fincaId,
      fincaIds: getFincaIdsPermitidas(user),
      loteId,
      tipoEvaluacionId,
    });

    // Suma Bruta calculada en el momento de la lectura (no se persiste), para
    // que los cambios de valores en `estadios_sigatoka` se reflejen al instante.
    const sumasBruta = rows.map((ev) => ev.sumaBruta).filter(Boolean);
    const hidratadas = await adjuntarTotales(sumasBruta);

    const items = rows.map((ev) => {
      const plano = ev.toJSON ? ev.toJSON() : ev;
      if (plano.sumaBruta) {
        const idx = sumasBruta.indexOf(ev.sumaBruta);
        if (idx !== -1) plano.sumaBruta = hidratadas[idx];
      }
      return plano;
    });
    return { items, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getEvaluacionByUuid(uuid, user) {
    const evaluacion = await evaluacionRepository.findByUuid(uuid, { fincaIds: getFincaIdsPermitidas(user) });
    if (!evaluacion) throw ApiError.notFound('Evaluación no encontrada');

    const plano = evaluacion.toJSON ? evaluacion.toJSON() : evaluacion;
    if (plano.sumaBruta) {
      const [hidratada] = await adjuntarTotales([evaluacion.sumaBruta]);
      plano.sumaBruta = hidratada;
    }
    return plano;
  },

  async createEvaluacion(payload, actorId, user) {
    const plantaConLote = await findPlantaConLoteByUuidOrFail(payload.plantaUuid);
    assertFincaPermitida(user, plantaConLote.lote?.fincaId);
    const planta = plantaConLote;
    const tipoEvaluacion = await findTipoEvaluacionByUuidOrFail(payload.tipoEvaluacionUuid);
    const semana = await findSemanaByUuidOrFail(payload.semanaUuid);
    const usuario = payload.usuarioUuid
      ? await findUsuarioByUuidOrFail(payload.usuarioUuid)
      : { id: actorId };

    return sequelize.transaction((transaction) =>
      evaluacionRepository.create(
        {
          plantaId: planta.id,
          usuarioId: usuario.id,
          tipoEvaluacionId: tipoEvaluacion.id,
          semanaId: semana.id,
          fecha: payload.fecha,
          observacion: payload.observacion,
          estado: payload.estado ?? true,
          createdBy: actorId,
        },
        { transaction },
      ),
    );
  },

  async updateEvaluacion(uuid, payload, actorId, user) {
    const evaluacion = await this.getEvaluacionByUuid(uuid, user);
    const data = { updatedBy: actorId };

    if (payload.plantaUuid) {
      const plantaConLote = await findPlantaConLoteByUuidOrFail(payload.plantaUuid);
      assertFincaPermitida(user, plantaConLote.lote?.fincaId);
      data.plantaId = plantaConLote.id;
    }
    if (payload.tipoEvaluacionUuid) {
      data.tipoEvaluacionId = (await findTipoEvaluacionByUuidOrFail(payload.tipoEvaluacionUuid)).id;
    }
    if (payload.semanaUuid) data.semanaId = (await findSemanaByUuidOrFail(payload.semanaUuid)).id;
    if (payload.usuarioUuid) data.usuarioId = (await findUsuarioByUuidOrFail(payload.usuarioUuid)).id;
    if (payload.fecha !== undefined) data.fecha = payload.fecha;
    if (payload.observacion !== undefined) data.observacion = payload.observacion;
    if (payload.estado !== undefined) data.estado = payload.estado;

    return evaluacionRepository.update(evaluacion, data);
  },

  async deleteEvaluacion(uuid, actorId, user) {
    const evaluacion = await this.getEvaluacionByUuid(uuid, user);
    await evaluacionRepository.softDelete(evaluacion, actorId);
  },

  // Promedio de Suma Bruta por semana. Con `fincaUuid` se calcula solo para
  // esa finca; sin él, para todas las fincas permitidas. El total de cada
  // evaluación se calcula al vuelo con la configuración vigente de estadios.
  async promedioSumaBrutaPorSemana(query, user) {
    const fincaId = query.fincaUuid ? (await findFincaByUuidOrFail(query.fincaUuid)).id : undefined;
    if (fincaId) assertFincaPermitida(user, fincaId);
    const anio = query.anio ? Number(query.anio) : undefined;

    const evaluaciones = await evaluacionRepository.findAllPorSemana({
      fincaId,
      fincaIds: getFincaIdsPermitidas(user),
      anio,
    });

    const conSuma = evaluaciones.filter((ev) => ev.sumaBruta);
    const hidratadas = await adjuntarTotales(conSuma.map((ev) => ev.sumaBruta));

    const porSemana = new Map();
    conSuma.forEach((ev, i) => {
      const semana = ev.semana;
      if (!semana) return;
      const entry = porSemana.get(semana.id) || {
        semanaCodigo: semana.codigo,
        numeroSemana: semana.numeroSemana,
        anio: semana.anio,
        cinta: semana.color,
        suma: 0,
        n: 0,
      };
      entry.suma += hidratadas[i].total;
      entry.n += 1;
      porSemana.set(semana.id, entry);
    });

    return this.finalizarPromedios(porSemana);
  },

  // Promedio de hojas funcionales (Conteo de Hojas) por semana de registro y
  // edad de la planta (semanas transcurridas desde su semana de embolse).
  async promedioConteoPorSemana(query, user) {
    const fincaId = query.fincaUuid ? (await findFincaByUuidOrFail(query.fincaUuid)).id : undefined;
    if (fincaId) assertFincaPermitida(user, fincaId);
    const anio = query.anio ? Number(query.anio) : undefined;

    const evaluaciones = await evaluacionRepository.findAllPorSemana({
      fincaId,
      fincaIds: getFincaIdsPermitidas(user),
      anio,
    });

    const porSemana = new Map();
    evaluaciones.forEach((ev) => {
      const semana = ev.semana;
      const embolse = ev.conteoHojas?.semanaEmbolse;
      if (!semana || !ev.conteoHojas || !embolse) return;
      const edad = semanasEntre(embolse.fechaInicio, semana.fechaInicio);
      if (edad === null) return;
      const key = `${semana.id}|${edad}`;
      const entry = porSemana.get(key) || {
        semanaCodigo: semana.codigo,
        numeroSemana: semana.numeroSemana,
        anio: semana.anio,
        edad,
        suma: 0,
        n: 0,
      };
      entry.suma += Number(ev.conteoHojas.hojasFuncionales) || 0;
      entry.n += 1;
      porSemana.set(key, entry);
    });

    return [...porSemana.values()]
      .map((e) => ({
        semanaCodigo: e.semanaCodigo,
        numeroSemana: e.numeroSemana,
        anio: e.anio,
        edad: e.edad,
        promedio: Number((e.suma / e.n).toFixed(2)),
        n: e.n,
      }))
      .sort((a, b) => a.anio - b.anio || a.numeroSemana - b.numeroSemana);
  },

  // Promedio de YLI, YLS y hojas totales (Índice de Infección) por semana.
  async promedioInfeccionPorSemana(query, user) {
    const fincaId = query.fincaUuid ? (await findFincaByUuidOrFail(query.fincaUuid)).id : undefined;
    if (fincaId) assertFincaPermitida(user, fincaId);
    const anio = query.anio ? Number(query.anio) : undefined;

    const evaluaciones = await evaluacionRepository.findAllPorSemana({
      fincaId,
      fincaIds: getFincaIdsPermitidas(user),
      anio,
    });

    const porSemana = new Map();
    evaluaciones.forEach((ev) => {
      const semana = ev.semana;
      if (!semana || !ev.infeccion) return;
      const entry = porSemana.get(semana.id) || {
        semanaCodigo: semana.codigo,
        numeroSemana: semana.numeroSemana,
        anio: semana.anio,
        sumaYli: 0,
        sumaYls: 0,
        sumaHojas: 0,
        n: 0,
      };
      entry.sumaYli += Number(ev.infeccion.yli) || 0;
      entry.sumaYls += Number(ev.infeccion.yls) || 0;
      entry.sumaHojas += Number(ev.infeccion.hojasTotales) || 0;
      entry.n += 1;
      porSemana.set(semana.id, entry);
    });

    return [...porSemana.values()]
      .map((e) => ({
        semanaCodigo: e.semanaCodigo,
        numeroSemana: e.numeroSemana,
        anio: e.anio,
        promedioYli: Number((e.sumaYli / e.n).toFixed(2)),
        promedioYls: Number((e.sumaYls / e.n).toFixed(2)),
        promedioHojasTotales: Number((e.sumaHojas / e.n).toFixed(2)),
        n: e.n,
      }))
      .sort((a, b) => a.anio - b.anio || a.numeroSemana - b.numeroSemana);
  },

  finalizarPromedios(porSemana) {
    return [...porSemana.values()]
      .map((e) => ({
        semanaCodigo: e.semanaCodigo,
        numeroSemana: e.numeroSemana,
        anio: e.anio,
        cinta: e.cinta,
        promedio: Number((e.suma / e.n).toFixed(2)),
        n: e.n,
      }))
      .sort((a, b) => a.anio - b.anio || a.numeroSemana - b.numeroSemana);
  },
};

export default evaluacionService;
