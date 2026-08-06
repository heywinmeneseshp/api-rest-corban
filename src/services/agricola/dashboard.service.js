import { Op, fn, col } from 'sequelize';
import { Finca, ProduccionSemanal, RacimoMovimiento, Semana } from '../../database/associations.js';
import { semanaRepository } from '../../repositories/agricola/semana.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { getFincaIdsPermitidas, expandirFincaIds } from '../../utils/fincaScope.js';

// `fincaIds` vacío/undefined = sin filtro (ve todo). `fincaIds: []` con
// `restringido: true` = el usuario está scoped a un conjunto vacío de
// fincas (ninguna asignada) y por lo tanto no debe ver ningún dato — se
// fuerza un id imposible en vez de omitir el filtro.
function fincaWhere(fincaIds, restringido = false) {
  if (!fincaIds || fincaIds.length === 0) {
    return restringido ? { fincaId: -1 } : {};
  }
  return { fincaId: { [Op.in]: fincaIds } };
}

export const dashboardService = {
  async getResumen(query, user) {
    const cantidadSemanas = Number(query.cantidadSemanas) || 14;
    // Se expande cada finca elegida a su Grupo de Finca (ver
    // utils/fincaScope.js) antes de intersectar con lo que el usuario puede
    // ver, así elegir una finca agrupada trae también la de su hermana.
    const fincaIdsElegidas = query.fincas
      ? await expandirFincaIds(query.fincas.split(',').map(Number).filter((id) => id > 0))
      : [];

    // El usuario puede elegir qué fincas mostrar en el dashboard (selector
    // de "fincas activas"), pero esa elección nunca puede exceder las
    // fincas que tiene asignadas. Sin restricción (Administrador) o sin
    // elección puntual, se usa el scope completo del usuario tal cual.
    const fincaIdsPermitidas = getFincaIdsPermitidas(user);
    let fincaIds;
    if (fincaIdsPermitidas === null) {
      fincaIds = fincaIdsElegidas;
    } else if (fincaIdsElegidas.length > 0) {
      fincaIds = fincaIdsElegidas.filter((id) => fincaIdsPermitidas.includes(id));
    } else {
      fincaIds = fincaIdsPermitidas;
    }
    const fw = fincaWhere(fincaIds, fincaIdsPermitidas !== null);

    // Ordenar por `semanaId` (el id interno de la tabla semanas) NO es
    // confiable: ese id solo refleja el orden en que se CREÓ cada fila de
    // semana, no el orden cronológico real — una carga histórica tardía
    // (ej. producción de 2023 subida recién ahora) puede terminar con un id
    // más alto que semanas más recientes. Hay que ordenar por año y número
    // de semana de verdad.
    const ultimaProduccion = await ProduccionSemanal.findOne({
      include: [{ model: Semana, as: 'semana', attributes: [] }],
      order: [
        [{ model: Semana, as: 'semana' }, 'anio', 'DESC'],
        [{ model: Semana, as: 'semana' }, 'numeroSemana', 'DESC'],
      ],
      attributes: ['semanaId'],
    });

    if (!ultimaProduccion) {
      throw ApiError.notFound('No hay registros de producción semanal');
    }

    const ultimaSemana = await Semana.findByPk(ultimaProduccion.semanaId);
    if (!ultimaSemana) {
      throw ApiError.notFound('Semana no encontrada');
    }

    const [cajasRow] = await ProduccionSemanal.findAll({
      where: { semanaId: ultimaSemana.id, ...fw },
      attributes: [[fn('SUM', col('cajas_20kg')), 'total']],
      raw: true,
    });
    const cajasProducidas = Number(cajasRow?.total || 0);

    const [cortesRow] = await RacimoMovimiento.findAll({
      where: { tipo: { [Op.in]: ['RECUSE', 'PROCESADO'] }, semanaRegistroId: ultimaSemana.id, ...fw },
      attributes: [[fn('SUM', col('cantidad')), 'total']],
      raw: true,
    });
    const racimosCortados = Number(cortesRow?.total || 0);
    const ratio = racimosCortados > 0 ? Math.round((cajasProducidas / racimosCortados) * 100) / 100 : 0;

    const semanaActual = await semanaRepository.findByFecha(new Date().toISOString().slice(0, 10));
    const semanasEmbolse = semanaActual ? await semanaRepository.findUltimasN(semanaActual.id, cantidadSemanas) : [];
    semanasEmbolse.reverse();
    const semanaEmbolseIds = semanasEmbolse.map((s) => s.id);

    const movimientos = semanaEmbolseIds.length > 0 ? await RacimoMovimiento.findAll({
      where: { semanaEmbolseId: { [Op.in]: semanaEmbolseIds }, ...fw },
      attributes: ['semanaEmbolseId', 'tipo', 'cantidad'],
    }) : [];

    const cajasPorSemana = semanaEmbolseIds.length > 0 ? await ProduccionSemanal.findAll({
      where: { semanaId: { [Op.in]: semanaEmbolseIds }, ...fw },
      attributes: ['semanaId', [fn('SUM', col('cajas_20kg')), 'total']],
      group: ['semanaId'],
      raw: true,
    }) : [];
    const cajasMap = new Map(cajasPorSemana.map((r) => [r.semanaId, Number(r.total)]));

    const porCohorte = Object.fromEntries(semanaEmbolseIds.map((id) => [id, { totalEmbolsado: 0, totalRepicado: 0, totalRecusado: 0, totalProcesado: 0 }]));

    for (const m of movimientos) {
      const c = porCohorte[m.semanaEmbolseId];
      if (!c) continue;
      if (m.tipo === 'EMBOLSE') c.totalEmbolsado += m.cantidad;
      else if (m.tipo === 'REPIQUE') c.totalRepicado += m.cantidad;
      else if (m.tipo === 'RECUSE') c.totalRecusado += m.cantidad;
      else if (m.tipo === 'PROCESADO') c.totalProcesado += m.cantidad;
    }

    const cohortes = semanasEmbolse.map((semana) => {
      const c = porCohorte[semana.id] || { totalEmbolsado: 0, totalRepicado: 0, totalRecusado: 0, totalProcesado: 0 };
      const diffMs = semanaActual ? new Date(semanaActual.fechaInicio) - new Date(semana.fechaInicio) : 0;
      const edadSemanas = Math.round(diffMs / (7 * 86400000)) + 1;
      const saldo = c.totalEmbolsado - c.totalRepicado - c.totalRecusado - c.totalProcesado;
      const racimosCortadosCohorte = c.totalRecusado + c.totalProcesado;
      const cajas = cajasMap.get(semana.id) || 0;
      return {
        semanaUuid: semana.uuid,
        semanaCodigo: semana.codigo,
        anio: semana.anio,
        numeroSemana: semana.numeroSemana,
        color: semana.color,
        edadSemanas,
        totalEmbolsado: c.totalEmbolsado,
        totalRepicado: c.totalRepicado,
        totalRecusado: c.totalRecusado,
        totalProcesado: c.totalProcesado,
        cajas,
        saldo,
        ratio: racimosCortadosCohorte > 0 ? Math.round((cajas / racimosCortadosCohorte) * 100) / 100 : 0,
        recobrosPct: c.totalEmbolsado > 0 ? Math.round((c.totalRecusado / c.totalEmbolsado) * 10000) / 100 : 0,
        aprovechamientoPct: c.totalEmbolsado > 0 ? Math.round(((c.totalRepicado + c.totalRecusado + c.totalProcesado) / c.totalEmbolsado) * 10000) / 100 : 0,
      };
    });

    const semanasRegistroIds = semanasEmbolse.map((s) => s.id);
    const cajasPorRegistro = semanasRegistroIds.length > 0 ? await ProduccionSemanal.findAll({
      where: { semanaId: { [Op.in]: semanasRegistroIds }, ...fw },
      attributes: ['semanaId', [fn('SUM', col('cajas_20kg')), 'total']],
      group: ['semanaId'],
      raw: true,
    }) : [];
    const cajasRegMap = new Map(cajasPorRegistro.map((r) => [r.semanaId, Number(r.total)]));

    const cortesPorRegistro = semanasRegistroIds.length > 0 ? await RacimoMovimiento.findAll({
      where: { tipo: { [Op.in]: ['RECUSE', 'PROCESADO'] }, semanaRegistroId: { [Op.in]: semanasRegistroIds }, ...fw },
      attributes: ['semanaRegistroId', [fn('SUM', col('cantidad')), 'total']],
      group: ['semanaRegistroId'],
      raw: true,
    }) : [];
    const cortesRegMap = new Map(cortesPorRegistro.map((r) => [r.semanaRegistroId, Number(r.total)]));

    const semanasRegistro = semanasEmbolse.map((semana) => {
      const cajasSem = cajasRegMap.get(semana.id) || 0;
      const cortesSem = cortesRegMap.get(semana.id) || 0;
      return {
        semanaUuid: semana.uuid,
        semanaCodigo: semana.codigo,
        anio: semana.anio,
        numeroSemana: semana.numeroSemana,
        cajas: cajasSem,
        racimosCortados: cortesSem,
        ratio: cortesSem > 0 ? Math.round((cajasSem / cortesSem) * 100) / 100 : 0,
      };
    });

    // Los 3 gráficos anuales (Ratio, Cajas Producidas, Embolses) van por año
    // seleccionable — antes quedaban fijos al año calendario actual, así
    // que una carga histórica (ej. producción desde 2023) nunca se veía
    // reflejada ahí. `anio` es opcional; sin elegir, cae al año actual.
    const anioActual = query.anio ? Number(query.anio) : new Date().getFullYear();
    const semanasAnio = await semanaRepository.findAllByAnio(anioActual);
    const aniosDisponibles = await semanaRepository.findAniosDistintos();
    const todasSemanaIds = semanasAnio.map((s) => s.id);

    const primeraEmbolse = todasSemanaIds.length > 0 ? await RacimoMovimiento.findOne({
      where: { tipo: 'EMBOLSE', semanaEmbolseId: { [Op.in]: todasSemanaIds }, ...fw },
      order: [['semanaEmbolseId', 'ASC']],
      attributes: ['semanaEmbolseId'],
      raw: true,
    }) : null;
    const primeraSemanaEmbolse = primeraEmbolse
      ? semanasAnio.find((s) => s.id === primeraEmbolse.semanaEmbolseId) : null;

    const cajasAnual = todasSemanaIds.length > 0 ? await ProduccionSemanal.findAll({
      where: { semanaId: { [Op.in]: todasSemanaIds }, ...fw },
      attributes: ['semanaId', [fn('SUM', col('cajas_20kg')), 'total']],
      group: ['semanaId'],
      raw: true,
    }) : [];
    const cajasAnualMap = new Map(cajasAnual.map((r) => [r.semanaId, Number(r.total)]));

    const cortesAnual = todasSemanaIds.length > 0 ? await RacimoMovimiento.findAll({
      where: { tipo: { [Op.in]: ['RECUSE', 'PROCESADO'] }, semanaRegistroId: { [Op.in]: todasSemanaIds }, ...fw },
      attributes: ['semanaRegistroId', [fn('SUM', col('cantidad')), 'total']],
      group: ['semanaRegistroId'],
      raw: true,
    }) : [];
    const cortesAnualMap = new Map(cortesAnual.map((r) => [r.semanaRegistroId, Number(r.total)]));

    const embolseRows = todasSemanaIds.length > 0 ? await RacimoMovimiento.findAll({
      where: { tipo: 'EMBOLSE', semanaEmbolseId: { [Op.in]: todasSemanaIds }, ...fw },
      attributes: ['semanaEmbolseId', [fn('SUM', col('cantidad')), 'total']],
      group: ['semanaEmbolseId'],
      raw: true,
    }) : [];
    const embolseAnualMap = new Map(embolseRows.map((r) => [r.semanaEmbolseId, Number(r.total)]));

    const salidasRows = todasSemanaIds.length > 0 ? await RacimoMovimiento.findAll({
      where: { tipo: { [Op.in]: ['RECUSE', 'PROCESADO'] }, semanaEmbolseId: { [Op.in]: todasSemanaIds }, ...fw },
      attributes: ['semanaEmbolseId', [fn('SUM', col('cantidad')), 'total']],
      group: ['semanaEmbolseId'],
      raw: true,
    }) : [];
    const salidasAnualMap = new Map(salidasRows.map((r) => [r.semanaEmbolseId, Number(r.total)]));

    // Lista de fincas seleccionables en el dashboard: se basa en el scope
    // completo del usuario (no en la elección puntual de `fw`), para que
    // pueda elegir entre cualquiera de SUS fincas asignadas.
    const fwScope = fincaWhere(fincaIdsPermitidas, fincaIdsPermitidas !== null);

    const fincasConCajas = await ProduccionSemanal.findAll({
      where: { semanaId: ultimaSemana.id, ...fwScope },
      attributes: ['fincaId', [fn('SUM', col('cajas_20kg')), 'totalCajas']],
      group: ['fincaId'],
      raw: true,
    });
    const fincaCajasMap = new Map(fincasConCajas.map((r) => [r.fincaId, Number(r.totalCajas)]));

    const fincasRecusados = await RacimoMovimiento.findAll({
      where: { tipo: 'RECUSE', semanaRegistroId: ultimaSemana.id, ...fwScope },
      attributes: ['fincaId', [fn('SUM', col('cantidad')), 'total']],
      group: ['fincaId'],
      raw: true,
    });
    const fincaRecusadosMap = new Map(fincasRecusados.map((r) => [r.fincaId, Number(r.total)]));

    const fincasProcesados = await RacimoMovimiento.findAll({
      where: { tipo: 'PROCESADO', semanaRegistroId: ultimaSemana.id, ...fwScope },
      attributes: ['fincaId', [fn('SUM', col('cantidad')), 'total']],
      group: ['fincaId'],
      raw: true,
    });
    const fincaProcesadosMap = new Map(fincasProcesados.map((r) => [r.fincaId, Number(r.total)]));

    const todasFincaIdsDashboard = [...new Set([...fincaCajasMap.keys(), ...fincaRecusadosMap.keys(), ...fincaProcesadosMap.keys()])];
    const fincas = todasFincaIdsDashboard.length > 0 ? await Finca.findAll({
      where: { id: { [Op.in]: todasFincaIdsDashboard } },
      attributes: ['id', 'codigo', 'nombre'],
      raw: true,
    }) : [];

    const fincasActivas = fincas.map((f) => {
      const cajasFinca = fincaCajasMap.get(f.id) || 0;
      const recusados = fincaRecusadosMap.get(f.id) || 0;
      const procesados = fincaProcesadosMap.get(f.id) || 0;
      const totalCortes = recusados + procesados;
      return {
        id: f.id,
        codigo: f.codigo,
        nombre: f.nombre,
        seleccionada: fincaIds.length === 0 || fincaIds.includes(f.id),
        cajas: cajasFinca,
        recusados,
        procesados,
        ratio: totalCortes > 0 ? Math.round((cajasFinca / totalCortes) * 100) / 100 : 0,
        aprovechamientoPct: totalCortes > 0 ? Math.round((procesados / totalCortes) * 10000) / 100 : 0,
      };
    }).sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));

    const hoy = new Date();
    const ratioAnual = semanasAnio.map((semana) => {
      const cajasSem = cajasAnualMap.get(semana.id) || 0;
      const cortesSem = cortesAnualMap.get(semana.id) || 0;
      const esFutura = new Date(semana.fechaInicio) > hoy;
      const sinDatos = cajasSem === 0 && cortesSem === 0;
      return {
        numeroSemana: semana.numeroSemana,
        semanaCodigo: semana.codigo,
        cajas: esFutura || sinDatos ? null : cajasSem,
        racimosCortados: esFutura || sinDatos ? null : cortesSem,
        ratio: esFutura || sinDatos ? null : (cortesSem > 0 ? Math.round((cajasSem / cortesSem) * 100) / 100 : 0),
      };
    });

    const embolseAnual = semanasAnio.map((semana) => {
      const embSem = embolseAnualMap.get(semana.id) || 0;
      const esFutura = new Date(semana.fechaInicio) > hoy;
      const sinDatos = embSem === 0;
      return {
        numeroSemana: semana.numeroSemana,
        semanaCodigo: semana.codigo,
        embolse: esFutura || sinDatos ? null : embSem,
      };
    });

    const aprovechamientoAnual = semanasAnio.map((semana) => {
      const embSem = embolseAnualMap.get(semana.id) || 0;
      const salSem = salidasAnualMap.get(semana.id) || 0;
      const esFutura = new Date(semana.fechaInicio) > hoy;
      const pct = embSem > 0 ? Math.round((salSem / embSem) * 10000) / 100 : null;
      return {
        numeroSemana: semana.numeroSemana,
        semanaCodigo: semana.codigo,
        aprovechamiento: esFutura || pct == null ? null : pct,
      };
    });

    return {
      fincasActivas,
      ultimaSemana: {
        uuid: ultimaSemana.uuid,
        codigo: ultimaSemana.codigo,
        anio: ultimaSemana.anio,
        numeroSemana: ultimaSemana.numeroSemana,
      },
      primeraSemanaEmbolse: primeraSemanaEmbolse ? {
        numeroSemana: primeraSemanaEmbolse.numeroSemana,
        codigo: primeraSemanaEmbolse.codigo,
      } : null,
      cajasProducidas,
      racimosCortados,
      ratio,
      cohortes,
      semanasRegistro,
      ratioAnual,
      embolseAnual,
      aprovechamientoAnual,
      anioSeleccionado: anioActual,
      aniosDisponibles,
    };
  },
};

export default dashboardService;
