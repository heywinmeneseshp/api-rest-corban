import { Op, fn, literal } from 'sequelize';
import { Finca, Lote, Semana, User, PrecalibracionRegistro, PrecalibracionEstimacion, RacimoMovimiento, EstimacionFinca } from '../../database/associations.js';
import { cargarConfig, edadesDeFinca, valoresDeFinca, unionEdades, unionValores } from './precalibracionConfig.service.js';
import { produccionSemanalRepository } from '../../repositories/agricola/produccionSemanal.repository.js';
import { racimoMovimientoRepository } from '../../repositories/agricola/racimoMovimiento.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { assertFincaPermitida, expandirFincaIds, getFincaIdsPermitidas } from '../../utils/fincaScope.js';

// Precalibración: cada racimo "apto" (cumple la medida del calibrador físico) es UN registro con hora y GPS.
// La cinta no es un catálogo: es la semana de embolse. Color = calcularColorSemana (Semana.color) y edad =
// semanas entre el embolse y la semana de la precalibración (edad 1 = embolsado esa misma semana, igual que en
// racimoMovimiento). Las edades que se precalibran son las de las columnas de la tabla.
// Las edades de cinta y los valores del calibrador son configurables (global y por finca): ver precalibracionConfig.service.js.
const VENTANA_RATIO = 26; // semanas atrás y adelante en el gráfico de ratio

const COLOR_HEX = {
  Azul: '#2563eb',
  Blanco: '#cbd5e1',
  Amarillo: '#eab308',
  Morado: '#7c3aed',
  Rojo: '#dc2626',
  Café: '#92400e',
  Negro: '#111827',
  Verde: '#16a34a',
  Gris: '#9ca3af',
};

const redondear = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const hoyBogota = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
// La conexión usa dateStrings: una fecha leída de la base llega como 'YYYY-MM-DD HH:mm:ss' en UTC, sin zona.
const comoDate = (v) => (typeof v === 'string' && !v.includes('T') ? new Date(`${v.replace(' ', 'T')}Z`) : new Date(v));
const fechaLocal = (fechaHora) => comoDate(fechaHora).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
const horaLocal = (fechaHora) =>
  comoDate(fechaHora).toLocaleTimeString('en-GB', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' });

// Calendario completo de semanas en orden cronológico real (por fechaInicio), para calcular edades por posición.
async function cargarCalendario() {
  const semanas = await Semana.findAll({
    order: [['fechaInicio', 'ASC']],
    attributes: ['id', 'uuid', 'codigo', 'anio', 'numeroSemana', 'fechaInicio', 'fechaFin'],
  });
  const idx = new Map(semanas.map((s, i) => [s.id, i]));
  const porUuid = new Map(semanas.map((s) => [s.uuid, s]));
  const hoy = hoyBogota();
  const actual = semanas.find((s) => s.fechaInicio <= hoy && s.fechaFin >= hoy) || semanas[semanas.length - 1] || null;
  return { semanas, idx, porUuid, actual };
}

const edadDe = (cal, semanaId, semanaEmbolseId) => {
  const a = cal.idx.get(semanaId);
  const b = cal.idx.get(semanaEmbolseId);
  return a === undefined || b === undefined ? null : a - b + 1;
};

const cintaDe = (cal, edad, semanaRef) => {
  const refIdx = semanaRef ? cal.idx.get(semanaRef.id) : undefined;
  const embolse = refIdx !== undefined ? cal.semanas[refIdx - (edad - 1)] : null;
  return {
    id: `edad-${edad}`,
    edad,
    nombre: embolse ? embolse.color || '' : `Edad ${edad}`,
    color: embolse ? COLOR_HEX[embolse.color] || '#6b7280' : '#6b7280',
    colorNombre: embolse ? embolse.color : '',
    embolse: embolse ? String(embolse.numeroSemana) : '—',
    embolseCodigo: embolse ? embolse.codigo : '—',
    semanaEmbolseUuid: embolse ? embolse.uuid : null,
    semanaEmbolseId: embolse ? embolse.id : null,
  };
};

async function resolverFiltros(query, user) {
  const filtros = {};
  if (query.fincaUuid) {
    const finca = await Finca.findOne({ where: { uuid: query.fincaUuid }, attributes: ['id', 'nombre'] });
    if (!finca) throw ApiError.badRequest('Finca no encontrada');
    assertFincaPermitida(user, finca.id);
    filtros.fincaIds = await expandirFincaIds([finca.id]);
    filtros.finca = finca;
  } else {
    filtros.fincaIds = getFincaIdsPermitidas(user);
  }
  if (query.loteUuid) {
    const lote = await Lote.findOne({ where: { uuid: query.loteUuid }, attributes: ['id'] });
    if (!lote) throw ApiError.badRequest('Lote no encontrado');
    filtros.loteId = lote.id;
  }
  filtros.semanaUuid = query.semanaUuid || null;
  filtros.valor = query.valor ? String(query.valor) : null;
  filtros.edad = query.edad ? Number(query.edad) : null;
  return filtros;
}

// Registros crudos del alcance (permisos + finca + lote + valor; la semana y la edad se filtran aparte porque
// el gráfico de ratio necesita todas las semanas).
async function cargarRegistros(filtros, { semanaId } = {}) {
  const where = {};
  if (filtros.fincaIds) where.fincaId = { [Op.in]: filtros.fincaIds };
  if (filtros.loteId) where.loteId = filtros.loteId;
  if (filtros.valor) where.valor = filtros.valor;
  if (semanaId) where.semanaId = semanaId;
  return PrecalibracionRegistro.findAll({
    where,
    attributes: ['id', 'uuid', 'fincaId', 'loteId', 'semanaEmbolseId', 'semanaId', 'valor', 'fechaHora', 'lat', 'lng', 'createdBy'],
    order: [['fechaHora', 'ASC']],
    raw: true,
  });
}

function valorPredominante(registros) {
  if (registros.length === 0) return null;
  const conteo = new Map();
  for (const r of registros) conteo.set(r.valor, (conteo.get(r.valor) || 0) + 1);
  const [valor] = [...conteo.entries()].sort((a, b) => b[1] - a[1])[0];
  return { id: valor, codigo: valor, nombre: `Calibre ${valor}` };
}

// Saldo actual (racimos embolsados - repicados - recusados - procesados) de cada lote y cinta de la tabla.
async function saldosPorLoteYCinta(lotes, cintas) {
  const cohortes = [];
  for (const l of lotes) {
    for (const c of cintas) {
      if (c.semanaEmbolseId) cohortes.push({ fincaId: l.fincaId, loteId: l.id, semanaEmbolseId: c.semanaEmbolseId });
    }
  }
  const mapa = await racimoMovimientoRepository.getSaldosCohortes(cohortes);
  return (lote, cinta) => (cinta.semanaEmbolseId ? mapa.get(`${lote.fincaId}-${lote.id}-${cinta.semanaEmbolseId}`) || 0 : 0);
}

// Saldo (embolsado - repicado - recusado - procesado) de las cohortes de las cintas de la tabla, por lote. Sirve para
// listar también los lotes que aún no tienen racimos precalibrados pero sí saldo en esas cintas.
async function saldosDeCintas(cintas, filtros) {
  const semanaIds = cintas.map((c) => c.semanaEmbolseId).filter(Boolean);
  if (semanaIds.length === 0) return [];
  const where = { semanaEmbolseId: { [Op.in]: semanaIds } };
  if (filtros.fincaIds) where.fincaId = { [Op.in]: filtros.fincaIds };
  if (filtros.loteId) where.loteId = filtros.loteId;
  const filas = await RacimoMovimiento.findAll({
    where,
    attributes: [
      'fincaId',
      'loteId',
      'semanaEmbolseId',
      [fn('COALESCE', fn('SUM', literal("CASE WHEN tipo = 'EMBOLSE' THEN cantidad ELSE -cantidad END")), 0), 'saldo'],
    ],
    group: ['fincaId', 'loteId', 'semanaEmbolseId'],
    raw: true,
  });
  return filas.map((f) => ({ ...f, saldo: Number(f.saldo) })).filter((f) => f.saldo > 0);
}

export const precalibracionService = {
  // Catálogos para los filtros de la pantalla (y para la app móvil: las cintas de hoy con su color).
  async getOpciones(user) {
    const cal = await cargarCalendario();
    const fincaIds = getFincaIdsPermitidas(user);
    const fincas = await Finca.findAll({
      where: fincaIds ? { id: { [Op.in]: fincaIds } } : {},
      attributes: ['id', 'uuid', 'codigo', 'nombre'],
      order: [['nombre', 'ASC']],
    });
    const lotes = await Lote.findAll({
      where: { fincaId: { [Op.in]: fincas.map((f) => f.id) } },
      attributes: ['uuid', 'nombre', 'fincaId'],
    });
    const fincaPorId = new Map(fincas.map((f) => [f.id, f]));
    const hasta = cal.actual ? cal.actual.fechaInicio : null;
    const config = await cargarConfig();
    const idsVisibles = fincas.map((f) => f.id);
    const edadesUnion = unionEdades(config, idsVisibles);
    const configPorFinca = {};
    for (const f of fincas) configPorFinca[f.uuid] = { edades: edadesDeFinca(config, f.id), valores: valoresDeFinca(config, f.id) };
    return {
      fincas: fincas.map((f) => ({ id: f.uuid, codigo: f.codigo, nombre: f.nombre })),
      lotes: lotes
        .filter((l) => fincaPorId.get(l.fincaId))
        .map((l) => ({ id: l.uuid, nombre: l.nombre, fincaId: fincaPorId.get(l.fincaId).uuid })),
      semanas: cal.semanas
        .filter((s) => !hasta || s.fechaInicio <= hasta)
        .map((s) => ({ id: s.uuid, codigo: s.codigo, numero: s.numeroSemana, anio: s.anio, fechaInicio: s.fechaInicio, fechaFin: s.fechaFin }))
        .reverse(),
      valores: unionValores(config, idsVisibles).map((v) => ({ id: v, codigo: v, nombre: `Calibre ${v}` })),
      // Configuración efectiva de cada finca (la app móvil ofrece solo las cintas y calibres de la finca elegida).
      configPorFinca,
      cintas: edadesUnion.map((e) => {
        const c = cintaDe(cal, e, cal.actual);
        return { id: c.id, edad: e, nombre: c.nombre, color: c.color, embolse: c.embolse, embolseCodigo: c.embolseCodigo, semanaEmbolseUuid: c.semanaEmbolseUuid };
      }),
      semanaActualId: cal.actual ? cal.actual.uuid : null,
    };
  },

  // Ingesta desde la app móvil (cola offline). Cada elemento es un racimo apto. Es idempotente por `uuid`: un
  // reenvío no duplica. Devuelve el resultado por elemento para que el móvil marque cuáles ya se sincronizaron.
  async registrar(payload, actorId, user) {
    const cal = await cargarCalendario();
    const items = payload.registros;

    const uuidsFinca = [...new Set(items.map((i) => i.fincaUuid))];
    const uuidsLote = [...new Set(items.map((i) => i.loteUuid))];
    const [fincas, lotes] = await Promise.all([
      Finca.findAll({ where: { uuid: { [Op.in]: uuidsFinca } }, attributes: ['id', 'uuid'] }),
      Lote.findAll({ where: { uuid: { [Op.in]: uuidsLote } }, attributes: ['id', 'uuid', 'fincaId'] }),
    ]);
    const fincaPorUuid = new Map(fincas.map((f) => [f.uuid, f]));
    const lotePorUuid = new Map(lotes.map((l) => [l.uuid, l]));
    const existentes = await PrecalibracionRegistro.findAll({
      where: { uuid: { [Op.in]: items.map((i) => i.uuid) } },
      attributes: ['uuid'],
      paranoid: false,
      raw: true,
    });
    const yaRegistrados = new Set(existentes.map((e) => e.uuid));

    const resultados = [];
    const filas = [];
    for (const item of items) {
      const error = (mensaje) => resultados.push({ uuid: item.uuid, estado: 'ERROR', mensaje });
      if (yaRegistrados.has(item.uuid)) {
        resultados.push({ uuid: item.uuid, estado: 'DUPLICADO' });
        continue;
      }
      const finca = fincaPorUuid.get(item.fincaUuid);
      const lote = lotePorUuid.get(item.loteUuid);
      const embolse = cal.porUuid.get(item.semanaEmbolseUuid);
      if (!finca) { error('Finca no encontrada'); continue; }
      if (!lote) { error('Lote no encontrado'); continue; }
      if (lote.fincaId !== finca.id) { error('El lote no pertenece a la finca'); continue; }
      if (!embolse) { error('Semana de embolse no encontrada'); continue; }
      try {
        assertFincaPermitida(user, finca.id);
      } catch {
        error('No tienes acceso a esa finca');
        continue;
      }
      const fecha = item.fecha || fechaLocal(item.fechaHora);
      const semana = cal.semanas.find((s) => s.fechaInicio <= fecha && s.fechaFin >= fecha);
      if (!semana) { error('No existe una semana para la fecha del registro'); continue; }
      const edad = edadDe(cal, semana.id, embolse.id);
      if (edad === null || edad < 1) { error('La semana de embolse es posterior a la fecha del registro'); continue; }
      filas.push({
        uuid: item.uuid,
        fincaId: finca.id,
        loteId: lote.id,
        semanaEmbolseId: embolse.id,
        semanaId: semana.id,
        valor: String(item.valor),
        fechaHora: item.fechaHora,
        lat: item.lat ?? null,
        lng: item.lng ?? null,
        createdBy: actorId,
      });
      resultados.push({ uuid: item.uuid, estado: 'CREADO' });
      yaRegistrados.add(item.uuid); // un uuid repetido dentro del mismo envío no se inserta dos veces
    }
    if (filas.length > 0) await PrecalibracionRegistro.bulkCreate(filas);
    return {
      total: items.length,
      creados: resultados.filter((r) => r.estado === 'CREADO').length,
      duplicados: resultados.filter((r) => r.estado === 'DUPLICADO').length,
      errores: resultados.filter((r) => r.estado === 'ERROR').length,
      resultados,
    };
  },

  // Dashboard: KPIs, tabla por lote (aptos, saldo y restante por cinta), distribución, ratio y potencial.
  async getResumen(query, user) {
    const filtros = await resolverFiltros(query, user);
    const cal = await cargarCalendario();
    // La precalibración siempre se consulta de UNA semana: la elegida o, por defecto, la actual.
    const semanaFiltro = filtros.semanaUuid ? cal.porUuid.get(filtros.semanaUuid) : cal.actual;
    if (filtros.semanaUuid && !semanaFiltro) throw ApiError.badRequest('Semana no encontrada');

    const config = await cargarConfig();
    // Alcance de la vista: la finca elegida o las que ve el usuario (null = todas). Las columnas son la unión de las
    // edades de esas fincas; cada registro cuenta solo si su edad está habilitada en SU finca.
    const alcanceFincas = filtros.finca
      ? [filtros.finca.id]
      : filtros.fincaIds || (await Finca.findAll({ attributes: ['id'], raw: true })).map((f) => f.id);
    const edadesVista = unionEdades(config, alcanceFincas);

    const todos = await cargarRegistros(filtros);
    const conEdad = todos
      .map((r) => ({ ...r, edad: edadDe(cal, r.semanaId, r.semanaEmbolseId) }))
      .filter((r) => edadesDeFinca(config, r.fincaId).includes(r.edad));
    const registros = conEdad.filter(
      (r) => (!semanaFiltro || r.semanaId === semanaFiltro.id) && (!filtros.edad || r.edad === filtros.edad),
    );

    // Semana de referencia (para colores/embolse de las columnas): la elegida; si no, la última con registros.
    let semanaRef = semanaFiltro;
    if (!semanaRef) {
      for (const r of registros) {
        const i = cal.idx.get(r.semanaId);
        if (i !== undefined && (!semanaRef || i > cal.idx.get(semanaRef.id))) semanaRef = cal.semanas[i];
      }
    }
    semanaRef = semanaRef || cal.actual;
    const cintas = edadesVista.map((e) => cintaDe(cal, e, semanaRef));

    const saldoFilas = await saldosDeCintas(cintas, filtros);
    const saldoMapa = new Map(saldoFilas.map((f) => [`${f.loteId}-${f.semanaEmbolseId}`, f.saldo]));
    const lotesEvaluadosIds = new Set(registros.map((r) => r.loteId));
    const loteIds = [...new Set([...lotesEvaluadosIds, ...saldoFilas.map((f) => f.loteId)])];
    const lotes = loteIds.length ? await Lote.findAll({ where: { id: { [Op.in]: loteIds } }, attributes: ['id', 'uuid', 'nombre', 'area', 'fincaId'] }) : [];
    const loteDe = new Map(lotes.map((l) => [l.id, l]));
    const fincas = lotes.length ? await Finca.findAll({ where: { id: { [Op.in]: [...new Set(lotes.map((l) => l.fincaId))] } }, attributes: ['id', 'uuid', 'nombre'] }) : [];
    const fincaDe = new Map(fincas.map((f) => [f.id, f]));
    const saldoDe = (lote, cinta) => saldoMapa.get(`${lote.id}-${cinta.semanaEmbolseId}`) || 0;
    const area = (l) => Number(l.area) || 0;

    // Tabla por lote.
    const porLote = new Map();
    for (const r of registros) {
      const fila = porLote.get(r.loteId) || { porCinta: {}, total: 0 };
      const k = `edad-${r.edad}`;
      fila.porCinta[k] = (fila.porCinta[k] || 0) + 1;
      fila.total += 1;
      porLote.set(r.loteId, fila);
    }
    const filas = [];
    for (const loteId of loteIds) {
      const f = porLote.get(loteId) || { porCinta: {}, total: 0 };
      const lote = loteDe.get(loteId);
      if (!lote) continue;
      const finca = fincaDe.get(lote.fincaId);
      const fila = {
        loteId: lote.uuid,
        loteNombre: lote.nombre,
        fincaId: finca ? finca.uuid : null,
        fincaNombre: finca ? finca.nombre : '—',
        areaHa: area(lote),
        porCinta: f.porCinta,
        total: f.total,
        saldos: {},
        restantes: {},
        totalSaldo: 0,
        totalRestante: 0,
      };
      for (const c of cintas) {
        const saldo = saldoDe(lote, c);
        const aptos = f.porCinta[c.id] || 0;
        fila.saldos[c.id] = saldo;
        fila.restantes[c.id] = saldo - aptos;
        fila.totalSaldo += saldo;
        fila.totalRestante += saldo - aptos;
      }
      filas.push(fila);
    }
    // Sin finca elegida ("Todas") no se discrimina por lote: una fila por finca (suma de sus lotes). El ratio por
    // hectárea usa solo el área de los lotes evaluados, igual que en las filas por lote.
    const agrupadoPorFinca = !query.fincaUuid && !query.loteUuid;
    if (agrupadoPorFinca) {
      const porFinca = new Map();
      for (const f of filas) {
        const g = porFinca.get(f.fincaId) || {
          loteId: null,
          loteNombre: null,
          fincaId: f.fincaId,
          fincaNombre: f.fincaNombre,
          areaHa: 0,
          porCinta: {},
          total: 0,
          saldos: {},
          restantes: {},
          totalSaldo: 0,
          totalRestante: 0,
        };
        if (f.total > 0) g.areaHa += f.areaHa;
        g.total += f.total;
        g.totalSaldo += f.totalSaldo;
        g.totalRestante += f.totalRestante;
        for (const c of cintas) {
          g.porCinta[c.id] = (g.porCinta[c.id] || 0) + (f.porCinta[c.id] || 0);
          g.saldos[c.id] = (g.saldos[c.id] || 0) + (f.saldos[c.id] || 0);
          g.restantes[c.id] = (g.restantes[c.id] || 0) + (f.restantes[c.id] || 0);
        }
        porFinca.set(f.fincaId, g);
      }
      filas.splice(0, filas.length, ...[...porFinca.values()].map((g) => ({ ...g, areaHa: redondear(g.areaHa) })));
    }
    filas.sort((a, b) =>
      a.fincaNombre === b.fincaNombre
        ? String(a.loteNombre).localeCompare(String(b.loteNombre), 'es', { numeric: true })
        : a.fincaNombre.localeCompare(b.fincaNombre, 'es'),
    );
    const totales = { porCinta: {}, saldoPorCinta: {}, restantePorCinta: {}, total: 0, totalSaldo: 0, totalRestante: 0, hectareas: 0 };
    for (const c of cintas) {
      totales.porCinta[c.id] = 0;
      totales.saldoPorCinta[c.id] = 0;
      totales.restantePorCinta[c.id] = 0;
    }
    for (const f of filas) {
      totales.total += f.total;
      totales.totalSaldo += f.totalSaldo;
      totales.totalRestante += f.totalRestante;
      for (const c of cintas) {
        totales.porCinta[c.id] += f.porCinta[c.id] || 0;
        totales.saldoPorCinta[c.id] += f.saldos[c.id] || 0;
        totales.restantePorCinta[c.id] += f.restantes[c.id] || 0;
      }
    }
    const hectareasEvaluadas = redondear([...lotesEvaluadosIds].reduce((a, id) => a + (loteDe.get(id) ? area(loteDe.get(id)) : 0), 0));
    totales.hectareas = hectareasEvaluadas;

    const distribucion = cintas.map((c) => ({
      cintaId: c.id,
      nombre: c.nombre,
      edad: c.edad,
      etiqueta: `Edad ${c.edad}`,
      racimos: registros.filter((r) => r.edad === c.edad).length,
      color: c.color,
    }));

    return {
      totalRegistros: registros.length,
      semanaReferencia: semanaRef ? { id: semanaRef.uuid, codigo: semanaRef.codigo } : null,
      cintas: cintas.map((c) => ({ ...c, semanaEmbolseId: undefined })),
      kpis: {
        racimos: registros.length,
        lotesEvaluados: lotesEvaluadosIds.size,
        hectareas: totales.hectareas,
        valor: valorPredominante(registros),
      },
      tabla: { filas, totales, agrupadoPor: agrupadoPorFinca ? 'finca' : 'lote' },
      distribucion,
      ratio: await this._ratio(cal, filtros),
      potencial: await this._potencial(cal, conEdad, filtros, semanaFiltro),
    };
  },

  // Ratio histórico (cajas producidas ÷ racimos cosechados) por semana: línea del año actual + promedio de la
  // misma semana del calendario en otros años. Sale de Producción Semanal (cajas) y de los movimientos de racimos
  // (PROCESADO + RECUSE por semana de registro) — el mismo ratio de Estimaciones de Fincas, NO de lo precalibrado:
  // así hay histórico aunque todavía no se haya precalibrado nada. Con varias fincas en el alcance, por semana solo
  // cuentan las que tienen cajas Y racimos ese mismo período (igual que el ratio del Dashboard).
  async _ratio(cal, filtros) {
    const fincaIds = filtros.fincaIds || (await Finca.findAll({ attributes: ['id'], raw: true })).map((f) => f.id);
    const actualIdx = cal.actual ? cal.idx.get(cal.actual.id) : cal.semanas.length - 1;
    const ventana = cal.semanas.slice(Math.max(0, actualIdx - VENTANA_RATIO), actualIdx + VENTANA_RATIO + 1);
    const numeros = new Set(ventana.map((s) => s.numeroSemana));
    const semanaIds = cal.semanas.filter((s) => numeros.has(s.numeroSemana)).map((s) => s.id);
    const [cajas, cosechado] = await Promise.all([
      produccionSemanalRepository.getCajasPorFincaYSemana({ fincaIds, semanaIds }),
      racimoMovimientoRepository.getCosechadoPorFincaYSemana({ fincaIds, semanaRegistroIds: semanaIds }),
    ]);
    const ratioDe = (semanaId) => {
      let c = 0;
      let r = 0;
      for (const fincaId of fincaIds) {
        const cj = cajas.get(`${fincaId}-${semanaId}`);
        const co = cosechado.get(`${fincaId}-${semanaId}`);
        if (cj > 0 && co > 0) {
          c += cj;
          r += co;
        }
      }
      return r > 0 ? redondear(c / r) : null;
    };
    return ventana.map((s) => {
      const otras = cal.semanas.filter((x) => x.numeroSemana === s.numeroSemana && x.anio !== s.anio).map((x) => ratioDe(x.id)).filter((v) => v !== null);
      return {
        semanaId: s.uuid,
        codigo: s.codigo,
        etiqueta: s.numeroSemana,
        ratioActual: ratioDe(s.id),
        promedio: otras.length ? redondear(otras.reduce((a, b) => a + b, 0) / otras.length) : null,
      };
    });
  },

  // Potencial de cosecha de la semana consultada: compara la estimación de las fincas (Estimación de fincas) con lo
  // precalibrado.
  //  - Cajas estimadas: las de la ÚLTIMA semana de registro que estimó esa semana, por finca (suma si hay varias
  //    filas de esa misma semana de registro).
  //  - Ratio (cajas por racimo): el guardado a mano para ese número de semana en la finca o, si no hay, el promedio
  //    histórico (cajas ÷ racimos cosechados) de la misma semana en años anteriores — el mismo criterio de "Cargar
  //    estimaciones". Racimos estimados = cajas ÷ ratio. Las fincas sin ratio no aportan racimos.
  //  - Precalibrado: racimos aptos de la semana en el alcance (finca elegida o todas).
  async _potencial(cal, conEdad, filtros, semana) {
    if (!semana) return null;
    const racimos = conEdad.filter((r) => r.semanaId === semana.id).length;
    const base = {
      semana: { id: semana.uuid, codigo: semana.codigo, numero: semana.numeroSemana },
      fincaNombre: filtros.finca ? filtros.finca.nombre : '',
      precal: { racimos },
      simulado: false,
    };

    // Último ajuste guardado desde esta pantalla (solo cuando hay una finca elegida).
    if (filtros.finca) {
      const ultimo = await PrecalibracionEstimacion.findOne({
        where: { fincaId: filtros.finca.id, semanaId: semana.id },
        order: [['createdAt', 'DESC']],
      });
      if (ultimo) {
        const autor = ultimo.createdBy ? await User.findOne({ where: { id: ultimo.createdBy }, attributes: ['nombre', 'apellido'], raw: true }) : null;
        base.ajusteGuardado = {
          id: ultimo.uuid,
          cajas: ultimo.cajas,
          ratio: ultimo.ratio === null ? null : Number(ultimo.ratio),
          racimosAptos: ultimo.racimosAptos,
          estimacionCajas: ultimo.estimacionCajas,
          creadoPor: autor ? `${autor.nombre} ${autor.apellido || ''}`.trim() : '',
          creadoEn: comoDate(ultimo.createdAt).toISOString(),
        };
      }
    }

    const fincas = await Finca.findAll({
      where: filtros.fincaIds ? { id: { [Op.in]: filtros.fincaIds } } : {},
      attributes: ['id', 'ratioCajasPorSemana'],
    });
    if (fincas.length === 0) return { ...base, estimacion: null };
    const fincaIds = fincas.map((f) => f.id);

    const filas = await EstimacionFinca.findAll({
      where: { semanaId: semana.id, fincaId: { [Op.in]: fincaIds } },
      attributes: ['fincaId', 'semanaRegistroId', 'cajas20kg'],
      raw: true,
    });
    if (filas.length === 0) return { ...base, estimacion: null };

    // Por finca, solo la semana de registro más reciente.
    const ultimaRegistro = new Map();
    for (const f of filas) {
      const idx = cal.idx.get(f.semanaRegistroId) ?? -1;
      if (!ultimaRegistro.has(f.fincaId) || idx > ultimaRegistro.get(f.fincaId)) ultimaRegistro.set(f.fincaId, idx);
    }
    const cajasPorFinca = new Map();
    for (const f of filas) {
      if ((cal.idx.get(f.semanaRegistroId) ?? -1) !== ultimaRegistro.get(f.fincaId)) continue;
      cajasPorFinca.set(f.fincaId, (cajasPorFinca.get(f.fincaId) || 0) + Number(f.cajas20kg));
    }

    // Ratio histórico: misma semana del calendario en años anteriores.
    const previas = cal.semanas.filter((x) => x.numeroSemana === semana.numeroSemana && x.fechaInicio < semana.fechaInicio);
    const previasIds = previas.map((x) => x.id);
    const [cajasHist, cosechadoHist] = await Promise.all([
      produccionSemanalRepository.getCajasPorFincaYSemana({ fincaIds, semanaIds: previasIds }),
      racimoMovimientoRepository.getCosechadoPorFincaYSemana({ fincaIds, semanaRegistroIds: previasIds }),
    ]);

    let cajas = 0;
    let cajasConRatio = 0;
    let racimosEstimados = 0;
    for (const finca of fincas) {
      const c = cajasPorFinca.get(finca.id);
      if (c === undefined) continue;
      cajas += c;
      const guardadoRaw = finca.ratioCajasPorSemana?.[String(semana.numeroSemana)];
      let ratio = guardadoRaw !== undefined && guardadoRaw !== null ? Number(guardadoRaw) : null;
      if (!ratio) {
        const ratios = previas
          .map((x) => {
            const cj = cajasHist.get(`${finca.id}-${x.id}`);
            const co = cosechadoHist.get(`${finca.id}-${x.id}`);
            return cj > 0 && co > 0 ? cj / co : null;
          })
          .filter((v) => v !== null);
        ratio = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : null;
      }
      if (ratio) {
        racimosEstimados += Math.round(c / ratio);
        cajasConRatio += c;
      }
    }

    return {
      ...base,
      estimacion: {
        racimos: racimosEstimados,
        ratio: racimosEstimados > 0 ? redondear(cajasConRatio / racimosEstimados, 3) : null,
        cajas: Math.round(cajas),
      },
    };
  },

  // Guarda un ajuste de estimación (cajas y ratio calculados con los racimos aptos) para una finca y la semana de la
  // precalibración. NO toca las estimaciones de la escalera: es una versión nueva en su propia tabla.
  async guardarEstimacion(payload, actorId, user) {
    const finca = await Finca.findOne({ where: { uuid: payload.fincaUuid }, attributes: ['id', 'uuid', 'nombre'] });
    if (!finca) throw ApiError.badRequest('Finca no encontrada');
    assertFincaPermitida(user, finca.id);
    const semana = await Semana.findOne({ where: { uuid: payload.semanaUuid }, attributes: ['id', 'uuid', 'codigo'] });
    if (!semana) throw ApiError.badRequest('Semana no encontrada');

    const creada = await PrecalibracionEstimacion.create({
      fincaId: finca.id,
      semanaId: semana.id,
      racimosAptos: payload.racimosAptos,
      ratio: payload.ratio ?? null,
      cajas: payload.cajas,
      estimacionCajas: payload.estimacionCajas ?? null,
      createdBy: actorId,
    });
    return { id: creada.uuid, finca: finca.nombre, semana: semana.codigo, cajas: creada.cajas, ratio: payload.ratio ?? null };
  },

  // Detalle de un lote: resultados por cinta (aptos, saldo y restante) y los registros con hora y GPS (mapa de recorrido).
  async getDetalleLote(loteUuid, query, user) {
    const lote = await Lote.findOne({ where: { uuid: loteUuid }, attributes: ['id', 'uuid', 'nombre', 'area', 'fincaId'] });
    if (!lote) throw ApiError.notFound('Lote no encontrado');
    assertFincaPermitida(user, lote.fincaId);
    const finca = await Finca.findOne({ where: { id: lote.fincaId }, attributes: ['uuid', 'nombre'] });

    const filtros = await resolverFiltros({ ...query, fincaUuid: undefined, loteUuid: undefined }, user);
    filtros.loteId = lote.id;
    const cal = await cargarCalendario();
    const semanaFiltro = filtros.semanaUuid ? cal.porUuid.get(filtros.semanaUuid) : cal.actual;

    const config = await cargarConfig();
    const edadesLote = edadesDeFinca(config, lote.fincaId);
    const todos = await cargarRegistros(filtros);
    const registros = todos
      .map((r) => ({ ...r, edad: edadDe(cal, r.semanaId, r.semanaEmbolseId) }))
      .filter((r) => edadesLote.includes(r.edad) && (!semanaFiltro || r.semanaId === semanaFiltro.id) && (!filtros.edad || r.edad === filtros.edad));

    let semanaRef = semanaFiltro;
    if (!semanaRef) {
      for (const r of registros) {
        const i = cal.idx.get(r.semanaId);
        if (i !== undefined && (!semanaRef || i > cal.idx.get(semanaRef.id))) semanaRef = cal.semanas[i];
      }
    }
    semanaRef = semanaRef || cal.actual;
    const cintas = edadesLote.map((e) => cintaDe(cal, e, semanaRef));
    const saldoDe = await saldosPorLoteYCinta([lote], cintas);

    const resultados = cintas.map((c) => {
      const n = registros.filter((r) => r.edad === c.edad).length;
      const saldo = saldoDe(lote, c);
      return { cintaId: c.id, cinta: c.nombre, edad: c.edad, embolse: c.embolse, embolseCodigo: c.embolseCodigo, racimos: n, saldo, restante: saldo - n, color: c.color };
    });

    const usuarios = await User.findAll({ where: { id: { [Op.in]: [...new Set(registros.map((r) => r.createdBy).filter(Boolean))] } }, attributes: ['id', 'nombre'], raw: true });
    const nombreUsuario = new Map(usuarios.map((u) => [u.id, u.nombre]));

    return {
      lote: { id: lote.uuid, nombre: lote.nombre, areaHa: Number(lote.area) || 0, fincaId: finca ? finca.uuid : null },
      finca: finca ? { id: finca.uuid, nombre: finca.nombre } : null,
      valor: valorPredominante(registros),
      resultados,
      total: registros.length,
      totalSaldo: resultados.reduce((a, r) => a + r.saldo, 0),
      totalRestante: resultados.reduce((a, r) => a + r.restante, 0),
      registros: registros.map((r) => ({
        id: r.uuid,
        edad: r.edad,
        cintaId: `edad-${r.edad}`,
        cintaNombre: (cintas.find((c) => c.edad === r.edad) || {}).nombre || '',
        cintaColor: (cintas.find((c) => c.edad === r.edad) || {}).color || '#64748b',
        valor: r.valor,
        fecha: fechaLocal(r.fechaHora),
        hora: horaLocal(r.fechaHora),
        lat: r.lat === null ? null : Number(r.lat),
        lng: r.lng === null ? null : Number(r.lng),
        usuarioNombre: nombreUsuario.get(r.createdBy) || '',
      })),
    };
  },
};

export default precalibracionService;
