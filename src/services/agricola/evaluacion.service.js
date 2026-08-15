import { Op } from 'sequelize';
import { sequelize } from '../../database/connection.js';
import { Planta, User, TipoEvaluacion, Semana, Finca, Lote } from '../../database/associations.js';
import { evaluacionRepository } from '../../repositories/agricola/evaluacion.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { getFincaIdsPermitidas, assertFincaPermitida, expandirFincaIds } from '../../utils/fincaScope.js';
import { adjuntarTotales, adjuntarValoresPorHoja, calcularIndicadorHoja } from './sumaBrutaTotal.js';

const HOJAS_INDICADOR = [3, 5];
import { calcularIndiceInfeccion } from './indiceInfeccion.js';

// Edad de la planta en semanas, contadas desde su semana de embolse: la
// semana en que se embolsa YA es edad 1 (no 0), la siguiente es edad 2, y
// así sucesivamente — por eso se suma 1 a la diferencia de semanas entre
// las dos fechas de inicio (mismo sistema ISO). Devuelve null si alguna
// fecha es inválida.
function semanasEntre(fechaInicioA, fechaInicioB) {
  const a = Date.parse(fechaInicioA);
  const b = Date.parse(fechaInicioB);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / (7 * 24 * 60 * 60 * 1000)) + 1;
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

// `query.fincaUuid` puede traer varias fincas separadas por coma (mismo
// criterio que clima.service.js) — para sumarlas en una sola línea de
// comparación en vez de una por finca. Sin `fincaUuid`, usa las fincas
// permitidas del usuario (null = todas, sin restricción).
const resolverFincaIds = async (query, user) => {
  if (!query.fincaUuid) return getFincaIdsPermitidas(user);
  const uuids = query.fincaUuid.split(',');
  const fincasEncontradas = await Finca.findAll({ where: { uuid: uuids } });
  if (fincasEncontradas.length === 0) throw ApiError.notFound('Finca no encontrada');
  fincasEncontradas.forEach((f) => assertFincaPermitida(user, f.id));
  return expandirFincaIds(fincasEncontradas.map((f) => f.id));
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
    // Si pidió una finca puntual, se expande a su Grupo de Finca (ver
    // utils/fincaScope.js); si no, se usa el alcance normal del usuario.
    const fincaIds = fincaId ? await expandirFincaIds([fincaId]) : getFincaIdsPermitidas(user);
    const loteId = query.loteUuid ? (await findLoteByUuidOrFail(query.loteUuid)).id : undefined;
    const semanaId = query.semanaUuid ? (await findSemanaByUuidOrFail(query.semanaUuid)).id : undefined;
    const usuarioId = query.usuarioUuid ? (await findUsuarioByUuidOrFail(query.usuarioUuid)).id : undefined;
    const tipoEvaluacionId = query.tipoEvaluacionUuid
      ? (await findTipoEvaluacionByUuidOrFail(query.tipoEvaluacionUuid)).id
      : undefined;

    const { rows, count } = await evaluacionRepository.findAndCountAll({
      limit,
      offset,
      fechaDesde: query.fechaDesde,
      fechaHasta: query.fechaHasta,
      fincaIds,
      loteId,
      semanaId,
      usuarioId,
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
      if (plano.infeccion) {
        plano.infeccion.indiceInfeccion = calcularIndiceInfeccion(plano.infeccion.hojas);
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
    if (plano.infeccion) {
      plano.infeccion.indiceInfeccion = calcularIndiceInfeccion(plano.infeccion.hojas);
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
  // Promedio = (Σ SB de las plantas evaluadas) / (N.° de lotes evaluados),
  // no de plantas — un lote con más plantas evaluadas no pesa más que uno
  // con menos.
  async promedioSumaBrutaPorSemana(query, user) {
    const fincaIds = await resolverFincaIds(query, user);
    const anio = query.anio ? Number(query.anio) : undefined;

    const evaluaciones = await evaluacionRepository.findAllPorSemana({
      fincaIds,
      anio,
    });

    const conSuma = evaluaciones.filter((ev) => ev.sumaBruta && ev.planta?.lote);
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
        lotes: new Set(),
      };
      entry.suma += hidratadas[i].total;
      entry.lotes.add(ev.planta.lote.id);
      porSemana.set(semana.id, entry);
    });

    return [...porSemana.values()]
      .map((e) => ({
        semanaCodigo: e.semanaCodigo,
        numeroSemana: e.numeroSemana,
        anio: e.anio,
        cinta: e.cinta,
        promedio: Number((e.suma / e.lotes.size).toFixed(2)),
        n: e.lotes.size,
      }))
      .sort((a, b) => a.anio - b.anio || a.numeroSemana - b.numeroSemana);
  },

  // Indicadores SB_H3 y SB_H5 por semana (ver calcularIndicadorHoja en
  // sumaBrutaTotal.js para la fórmula completa). A diferencia de
  // promedioSumaBrutaPorSemana (que promedia por LOTE), acá el grupo es
  // directamente todas las plantas evaluadas de la semana (dentro del
  // filtro de finca recibido) — N_plantas es la cantidad real de esas
  // plantas, nunca una constante fija.
  async promedioSumaBrutaPorHoja(query, user) {
    const fincaIds = await resolverFincaIds(query, user);
    const anio = query.anio ? Number(query.anio) : undefined;

    const evaluaciones = await evaluacionRepository.findAllPorSemana({
      fincaIds,
      anio,
    });

    const conSuma = evaluaciones.filter((ev) => ev.sumaBruta && ev.semana);
    const hidratadas = await adjuntarValoresPorHoja(conSuma.map((ev) => ev.sumaBruta));

    // Agrupa las plantas (con su sumaBruta ya hidratada) por semana.
    const porSemana = new Map();
    conSuma.forEach((ev, i) => {
      const semana = ev.semana;
      const entry = porSemana.get(semana.id) || {
        semanaCodigo: semana.codigo,
        numeroSemana: semana.numeroSemana,
        anio: semana.anio,
        plantas: [],
      };
      entry.plantas.push(hidratadas[i]);
      porSemana.set(semana.id, entry);
    });

    const items = [];
    porSemana.forEach((grupo) => {
      HOJAS_INDICADOR.forEach((hoja) => {
        items.push({
          semanaCodigo: grupo.semanaCodigo,
          numeroSemana: grupo.numeroSemana,
          anio: grupo.anio,
          hoja,
          promedio: calcularIndicadorHoja(grupo.plantas, hoja),
          n: grupo.plantas.length,
        });
      });
    });

    return items.sort((a, b) => a.anio - b.anio || a.numeroSemana - b.numeroSemana);
  },

  // Promedio de hojas funcionales (Conteo de Hojas) por semana de registro y
  // edad de la planta (semanas transcurridas desde su semana de embolse).
  async promedioConteoPorSemana(query, user) {
    const fincaIds = await resolverFincaIds(query, user);
    const anio = query.anio ? Number(query.anio) : undefined;

    const evaluaciones = await evaluacionRepository.findAllPorSemana({
      fincaIds,
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
        cinta: semana.color,
        cintaEmbolse: embolse.color,
        semanaEmbolseCodigo: embolse.codigo,
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
        cinta: e.cinta,
        cintaEmbolse: e.cintaEmbolse,
        semanaEmbolseCodigo: e.semanaEmbolseCodigo,
        edad: e.edad,
        promedio: Number((e.suma / e.n).toFixed(2)),
        n: e.n,
      }))
      .sort((a, b) => a.anio - b.anio || a.numeroSemana - b.numeroSemana);
  },

  // Promedio de YLI, YLS, hojas totales e Índice de Infección por semana.
  // El promedio del índice se calcula aparte (sumaIndice/nIndice): solo
  // cuentan las evaluaciones que tienen al menos una hoja evaluada, así una
  // evaluación sin datos de hojas no arrastra el promedio hacia abajo.
  async promedioInfeccionPorSemana(query, user) {
    const fincaIds = await resolverFincaIds(query, user);
    const anio = query.anio ? Number(query.anio) : undefined;

    const evaluaciones = await evaluacionRepository.findAllPorSemana({
      fincaIds,
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
        sumaIndice: 0,
        nIndice: 0,
        n: 0,
      };
      entry.sumaYli += Number(ev.infeccion.yli) || 0;
      entry.sumaYls += Number(ev.infeccion.yls) || 0;
      entry.sumaHojas += Number(ev.infeccion.hojasTotales) || 0;
      const indice = calcularIndiceInfeccion(ev.infeccion.hojas);
      if (indice !== null) {
        entry.sumaIndice += indice;
        entry.nIndice += 1;
      }
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
        promedioIndiceInfeccion: e.nIndice > 0 ? Number((e.sumaIndice / e.nIndice).toFixed(2)) : null,
        n: e.n,
      }))
      .sort((a, b) => a.anio - b.anio || a.numeroSemana - b.numeroSemana);
  },

  // Alertas por finca de la última semana ya cerrada (fechaFin < hoy):
  // YLI promedio por debajo de 8, o Índice de Infección promedio por
  // encima de 33%. No hay cron/notificaciones en el proyecto — se calcula
  // on-demand al abrir la pantalla, mismo patrón que
  // precipitacionDiaria.listInconsistencias().
  async alertasSemanaCerrada(query, user) {
    let semana;
    if (query.semanaUuid) {
      semana = await findSemanaByUuidOrFail(query.semanaUuid);
    } else {
      const hoyIso = new Date().toISOString().slice(0, 10);
      semana = await Semana.findOne({
        where: { fechaFin: { [Op.lt]: hoyIso } },
        order: [['fechaFin', 'DESC']],
      });
    }
    if (!semana) return { semana: null, alertas: [] };

    const fincaIds = getFincaIdsPermitidas(user);
    const evaluaciones = await evaluacionRepository.findAllPorSemana({
      fincaIds,
      semanaId: semana.id,
    });

    const porFinca = new Map();
    evaluaciones.forEach((ev) => {
      const finca = ev.planta?.lote?.finca;
      if (!finca || !ev.infeccion) return;
      const entry = porFinca.get(finca.id) || {
        fincaUuid: finca.uuid,
        fincaNombre: finca.nombre,
        sumaYli: 0,
        sumaIndice: 0,
        nIndice: 0,
        n: 0,
      };
      entry.sumaYli += Number(ev.infeccion.yli) || 0;
      const indice = calcularIndiceInfeccion(ev.infeccion.hojas);
      if (indice !== null) {
        entry.sumaIndice += indice;
        entry.nIndice += 1;
      }
      entry.n += 1;
      porFinca.set(finca.id, entry);
    });

    const UMBRAL_YLI = 8;
    const UMBRAL_INDICE = 33;
    const alertas = [];
    porFinca.forEach((e) => {
      const promedioYli = e.n > 0 ? Number((e.sumaYli / e.n).toFixed(2)) : null;
      const promedioIndice = e.nIndice > 0 ? Number((e.sumaIndice / e.nIndice).toFixed(2)) : null;
      const motivos = [];
      if (promedioYli !== null && promedioYli < UMBRAL_YLI) {
        motivos.push({ tipo: 'yli_bajo', mensaje: `YLI promedio (${promedioYli}) por debajo de ${UMBRAL_YLI}` });
      }
      if (promedioIndice !== null && promedioIndice > UMBRAL_INDICE) {
        motivos.push({ tipo: 'indice_alto', mensaje: `Índice de Infección promedio (${promedioIndice}%) por encima de ${UMBRAL_INDICE}%` });
      }
      if (motivos.length > 0) {
        alertas.push({
          fincaUuid: e.fincaUuid,
          fincaNombre: e.fincaNombre,
          promedioYli,
          promedioIndice,
          motivos,
        });
      }
    });

    return {
      semana: { uuid: semana.uuid, codigo: semana.codigo, numeroSemana: semana.numeroSemana, anio: semana.anio, fechaInicio: semana.fechaInicio, fechaFin: semana.fechaFin },
      alertas: alertas.sort((a, b) => a.fincaNombre.localeCompare(b.fincaNombre)),
    };
  },

  // Indicadores de una semana puntual (o año, si no llega semanaUuid):
  // cuántas evaluaciones hizo cada usuario de cada tipo en cada finca, más
  // los promedios semanales de índice de infección, suma bruta y hojas por
  // edad de la planta. Es el "tablero" de la página de evaluaciones.
  async indicadoresPorSemana(query, user) {
    const fincaId = query.fincaUuid ? (await findFincaByUuidOrFail(query.fincaUuid)).id : undefined;
    if (fincaId) assertFincaPermitida(user, fincaId);
    const fincaIds = fincaId ? await expandirFincaIds([fincaId]) : getFincaIdsPermitidas(user);
    const semana = query.semanaUuid ? await findSemanaByUuidOrFail(query.semanaUuid) : undefined;
    const anio = query.anio ? Number(query.anio) : semana?.anio;
    const usuarioId = query.usuarioUuid ? (await findUsuarioByUuidOrFail(query.usuarioUuid)).id : undefined;
    const lote = query.loteUuid ? await findLoteByUuidOrFail(query.loteUuid) : undefined;
    if (lote) assertFincaPermitida(user, lote.fincaId);

    const evaluaciones = await evaluacionRepository.findAllPorSemana({
      fincaIds,
      anio,
      semanaId: semana?.id,
      loteId: lote?.id,
    });

    // Evaluadores con registros en el período (semana o año) ya limitado por
    // finca — alimentan el selector de usuario del panel; no depende del
    // filtro de usuario elegido.
    const evaluadores = [];
    const vistos = new Set();
    evaluaciones.forEach((ev) => {
      const u = ev.usuario;
      if (!u?.uuid || vistos.has(u.uuid)) return;
      vistos.add(u.uuid);
      evaluadores.push({
        uuid: u.uuid,
        usuario: u.usuario,
        nombre: u.nombre,
        apellido: u.apellido,
      });
    });
    evaluadores.sort((a, b) => `${a.nombre || ''} ${a.apellido || ''}`.localeCompare(`${b.nombre || ''} ${b.apellido || ''}`));

    const filtradas = usuarioId ? evaluaciones.filter((ev) => ev.usuario?.id === usuarioId) : evaluaciones;

    // Suma Bruta calculada en el momento de la lectura (no se persiste).
    const conSuma = filtradas.filter((ev) => ev.sumaBruta);
    const hidratadas = await adjuntarTotales(conSuma.map((ev) => ev.sumaBruta));
    const totalPorSumaId = new Map(hidratadas.map((h) => [h.id, h.total]));

        // Árbol para el drill-down: finca → lote, con los conteos por tipo en
    // cada nivel. La finca llega anidada en planta -> lote -> finca; un
    // registro sin finca no cuenta (datos viejos).
    const arbol = new Map();
    let sumaIndice = 0;
    let nIndice = 0;
    let sumaYli = 0;
    let sumaYls = 0;
    let sumaHojasTotales = 0;
    let nInfeccion = 0;
    let sumaBruta = 0;
    let nBruta = 0;
    const porEdad = new Map();

    for (let i = 0; i < filtradas.length; i++) {
      const ev = filtradas[i];
      const fincaNombre = ev.planta?.lote?.finca?.nombre;
      if (fincaNombre) {
        const tipo = ev.tipoEvaluacion?.nombre || 'Sin tipo';
        const loteNombre = ev.planta?.lote?.nombre || 'Sin lote';

        let nodoFinca = arbol.get(fincaNombre);
        if (!nodoFinca) {
          nodoFinca = { finca: fincaNombre, uuid: ev.planta?.lote?.finca?.uuid, total: 0, tipos: new Map(), lotes: new Map() };
          arbol.set(fincaNombre, nodoFinca);
        }
        let nodoLote = nodoFinca.lotes.get(loteNombre);
        if (!nodoLote) {
          nodoLote = { lote: loteNombre, uuid: ev.planta?.lote?.uuid, total: 0, tipos: new Map() };
          nodoFinca.lotes.set(loteNombre, nodoLote);
        }
        nodoFinca.total += 1;
        nodoLote.total += 1;
        nodoFinca.tipos.set(tipo, (nodoFinca.tipos.get(tipo) || 0) + 1);
        nodoLote.tipos.set(tipo, (nodoLote.tipos.get(tipo) || 0) + 1);
      }

      // Promedios semanales.
      if (ev.infeccion) {
        const indice = calcularIndiceInfeccion(ev.infeccion.hojas);
        if (indice !== null) {
          sumaIndice += indice;
          nIndice += 1;
        }
        sumaYli += Number(ev.infeccion.yli) || 0;
        sumaYls += Number(ev.infeccion.yls) || 0;
        sumaHojasTotales += Number(ev.infeccion.hojasTotales) || 0;
        nInfeccion += 1;
      }
      if (ev.sumaBruta && ev.semana) {
        const total = totalPorSumaId.get(ev.sumaBruta.id);
        if (total !== undefined) {
          sumaBruta += total;
          nBruta += 1;
        }
      }
      if (ev.conteoHojas?.hojasFuncionales !== null && ev.conteoHojas?.hojasFuncionales !== undefined && ev.semana && ev.conteoHojas.semanaEmbolse) {
        const edad = semanasEntre(ev.conteoHojas.semanaEmbolse.fechaInicio, ev.semana.fechaInicio);
        if (edad !== null) {
          const entry = porEdad.get(edad) || {
            edad,
            semanaEmbolseCodigo: ev.conteoHojas.semanaEmbolse.codigo,
            cintaEmbolse: ev.conteoHojas.semanaEmbolse.color,
            suma: 0,
            n: 0,
            evaluaciones: [],
          };
          entry.suma += Number(ev.conteoHojas.hojasFuncionales) || 0;
          entry.n += 1;
          entry.evaluaciones.push({
            uuid: ev.uuid,
            fecha: ev.fecha,
            hojas: Number(ev.conteoHojas.hojasFuncionales) || 0,
            lote: ev.planta?.lote?.nombre,
            finca: ev.planta?.lote?.finca?.nombre,
          });
          porEdad.set(edad, entry);
        }
      }
    }

    const aPlano = (tipos) => Object.fromEntries([...tipos.entries()].sort((a, b) => a[0].localeCompare(b[0])));

    // Precipitación acumulada (mm) de los días de la semana, de las fincas
    // del alcance (la finca puntual ya viene expandida a su Grupo de Finca
    // en `fincaIds`). Se toma exclusivamente de la tabla `clima`.
    let precipitacion = null;
    if (semana) {
      const fincaUuids = fincaIds
        ? (await Finca.findAll({ where: { id: { [Op.in]: fincaIds } }, attributes: ['uuid'] })).map((f) => f.uuid)
        : null;
      const replacements = { desde: semana.fechaInicio, hasta: semana.fechaFin };
      let whereFinca = '';
      if (fincaUuids?.length) {
        whereFinca = ' AND finca_uuid IN (:fincaUuids)';
        replacements.fincaUuids = fincaUuids;
      }
      const [fila] = await sequelize.query(
        `SELECT COALESCE(SUM(mm), 0) AS total
           FROM clima
          WHERE fecha BETWEEN :desde AND :hasta${whereFinca}`,
        { replacements, type: 'SELECT' },
      );
      precipitacion = Number(fila?.total) || 0;
    }

    const porFinca = [...arbol.values()]
      .map((f) => ({
        finca: f.finca,
        uuid: f.uuid,
        total: f.total,
        tipos: aPlano(f.tipos),
        lotes: [...f.lotes.values()]
          .map((l) => ({
            lote: l.lote,
            uuid: l.uuid,
            total: l.total,
            tipos: aPlano(l.tipos),
          }))
          .sort((a, b) => a.lote.localeCompare(b.lote)),
      }))
      .sort((a, b) => a.finca.localeCompare(b.finca));

    return {
      semana: semana
        ? { uuid: semana.uuid, codigo: semana.codigo, numeroSemana: semana.numeroSemana, anio: semana.anio }
        : null,
      totalEvaluaciones: filtradas.length,
      evaluadores,
      porFinca,
      precipitacion,
      promedios: {
        indiceInfeccion: nIndice > 0 ? Number((sumaIndice / nIndice).toFixed(2)) : null,
        yli: nInfeccion > 0 ? Number((sumaYli / nInfeccion).toFixed(2)) : null,
        yls: nInfeccion > 0 ? Number((sumaYls / nInfeccion).toFixed(2)) : null,
        hojasTotales: nInfeccion > 0 ? Number((sumaHojasTotales / nInfeccion).toFixed(2)) : null,
        sumaBruta: nBruta > 0 ? Number((sumaBruta / nBruta).toFixed(2)) : null,
        hojasPorEdad: [...porEdad.values()]
          .map((e) => ({
            edad: e.edad,
            semanaEmbolseCodigo: e.semanaEmbolseCodigo,
            cintaEmbolse: e.cintaEmbolse,
            promedio: Number((e.suma / e.n).toFixed(2)),
            n: e.n,
            evaluaciones: e.evaluaciones.sort((a, b) => (a.fecha < b.fecha ? -1 : 1)),
          }))
          .sort((a, b) => a.edad - b.edad),
      },
    };
  },
};

export default evaluacionService;
