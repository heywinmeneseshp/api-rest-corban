import { Op, fn, col, literal } from 'sequelize';
import {
  RacimoMovimiento,
  Finca,
  Lote,
  Semana,
  MotivoRepique,
  MotivoRecuse,
  User,
} from '../../database/associations.js';

const listIncludes = [
  { model: Finca, as: 'finca', attributes: ['id', 'uuid', 'codigo', 'nombre'] },
  { model: Lote, as: 'lote', attributes: ['id', 'uuid', 'codigo', 'nombre'] },
  {
    model: Semana,
    as: 'semanaEmbolse',
    attributes: ['id', 'uuid', 'codigo', 'anio', 'numeroSemana', 'color', 'fechaInicio'],
  },
  {
    model: Semana,
    as: 'semanaRegistro',
    attributes: ['id', 'uuid', 'codigo', 'anio', 'numeroSemana', 'color', 'fechaInicio'],
  },
  { model: MotivoRepique, as: 'motivoRepique', attributes: ['id', 'uuid', 'nombre', 'codigoExterno'] },
  { model: MotivoRecuse, as: 'motivoRecuse', attributes: ['id', 'uuid', 'nombre', 'codigoExterno'] },
  { model: User, as: 'creadoPor', attributes: ['id', 'uuid', 'usuario', 'nombre'] },
];

export const racimoMovimientoRepository = {
  async findAndCountAll({
    limit,
    offset,
    fincaId,
    fincaIds,
    loteId,
    semanaEmbolseId,
    semanaRegistroId,
    semanaRegistroIds,
    usuarioId,
    tipo,
    fechaDesde,
    fechaHasta,
  }) {
    const where = {
      ...(fincaId ? { fincaId } : fincaIds ? { fincaId: { [Op.in]: fincaIds } } : {}),
      ...(loteId ? { loteId } : {}),
      ...(semanaEmbolseId ? { semanaEmbolseId } : {}),
      ...(semanaRegistroIds ? { semanaRegistroId: { [Op.in]: semanaRegistroIds } } : semanaRegistroId ? { semanaRegistroId } : {}),
      ...(usuarioId ? { createdBy: usuarioId } : {}),
      ...(tipo ? { tipo } : {}),
      ...(fechaDesde || fechaHasta
        ? {
            fecha: {
              ...(fechaDesde ? { [Op.gte]: fechaDesde } : {}),
              ...(fechaHasta ? { [Op.lte]: fechaHasta } : {}),
            },
          }
        : {}),
    };

    return RacimoMovimiento.findAndCountAll({
      where,
      include: listIncludes,
      limit,
      offset,
      order: [['fecha', 'DESC'], ['id', 'DESC']],
      distinct: true,
    });
  },

  findByUuid(uuid) {
    return RacimoMovimiento.findOne({ where: { uuid }, include: listIncludes });
  },

  findById(id) {
    return RacimoMovimiento.findByPk(id);
  },

  create(data, { transaction } = {}) {
    return RacimoMovimiento.create(data, { transaction });
  },

  bulkCreate(dataArray, { transaction } = {}) {
    return RacimoMovimiento.bulkCreate(dataArray, { transaction });
  },

  async getSaldosCohortes(cohortes) {
    if (cohortes.length === 0) return new Map();

    const results = await RacimoMovimiento.findAll({
      where: {
        [Op.or]: cohortes.map((c) => ({
          fincaId: c.fincaId,
          loteId: c.loteId,
          semanaEmbolseId: c.semanaEmbolseId,
        })),
      },
      attributes: [
        'fincaId',
        'loteId',
        'semanaEmbolseId',
        [fn('COALESCE', fn('SUM', literal("CASE WHEN tipo = 'EMBOLSE' THEN cantidad ELSE -cantidad END")), 0), 'saldo'],
      ],
      group: ['fincaId', 'loteId', 'semanaEmbolseId'],
      raw: true,
    });

    const map = new Map();
    for (const r of results) {
      map.set(`${r.fincaId}-${r.loteId}-${r.semanaEmbolseId}`, Number(r.saldo));
    }
    return map;
  },

  // Total por semana de un tipo de movimiento (EMBOLSE por defecto), para
  // el gráfico de embolses/repiques del año. `semanaIds` son las semanas
  // del año consultado; `fincaId` es opcional (si no se da, suma todas las
  // fincas). `tipo` deja reutilizar el mismo cálculo para Repique (u otro
  // tipo) sin duplicar el método — ver getReporteEmbolses. `campo` elige
  // contra qué columna de semana agrupar: `semanaEmbolseId` (la cinta —
  // tiene sentido para Embolse, que define su propia cohorte) o
  // `semanaRegistroId` (cuándo se registró el movimiento — lo que pidió el
  // usuario para Repique: "por semana de registro", no por cinta de
  // origen).
  async getEmbolsePorSemana({ semanaIds, fincaId, fincaIds, tipo = 'EMBOLSE', campo = 'semanaEmbolseId', motivoRepiqueId }) {
    if (semanaIds.length === 0) return new Map();

    const results = await RacimoMovimiento.findAll({
      where: {
        tipo,
        [campo]: { [Op.in]: semanaIds },
        ...(fincaId ? { fincaId } : fincaIds ? { fincaId: { [Op.in]: fincaIds } } : {}),
        ...(motivoRepiqueId ? { motivoRepiqueId: Array.isArray(motivoRepiqueId) ? { [Op.in]: motivoRepiqueId } : motivoRepiqueId } : {}),
      },
      attributes: [campo, [fn('SUM', col('cantidad')), 'total']],
      group: [campo],
      raw: true,
    });

    const map = new Map();
    for (const r of results) map.set(r[campo], Number(r.total));
    return map;
  },

  // Racimos cosechados (= cortados) por finca y semana de registro: la
  // regla de negocio es PROCESADO + RECUSE sumados, nunca PROCESADO solo
  // (un racimo cortado puede terminar recusado en vez de procesado, pero
  // igual salió del campo en el corte). Formaliza el mismo cálculo que hoy
  // vive inline en dashboard.service.js, para reutilizarlo en Pronóstico.
  async getCosechadoPorFincaYSemana({ fincaIds, semanaRegistroIds }) {
    if (semanaRegistroIds.length === 0) return new Map();

    const results = await RacimoMovimiento.findAll({
      where: {
        tipo: { [Op.in]: ['PROCESADO', 'RECUSE'] },
        semanaRegistroId: { [Op.in]: semanaRegistroIds },
        ...(fincaIds ? { fincaId: { [Op.in]: fincaIds } } : {}),
      },
      attributes: ['fincaId', 'semanaRegistroId', [fn('SUM', col('cantidad')), 'total']],
      group: ['fincaId', 'semanaRegistroId'],
      raw: true,
    });

    const map = new Map();
    for (const r of results) map.set(`${r.fincaId}-${r.semanaRegistroId}`, Number(r.total));
    return map;
  },

  // Cosechado (PROCESADO+RECUSE) agrupado por su cohorte de ORIGEN real
  // (finca + semana de embolse + semana de registro donde se cortó) — a
  // diferencia de getCosechadoPorFincaYSemana, esto no asume a qué edad
  // pertenece cada racimo cortado: cada movimiento de corte/recuse ya trae
  // su propio `semanaEmbolseId`, así que la edad real se puede calcular
  // exacta (semanaRegistro − semanaEmbolse) en vez de repartir el total
  // cortado de una semana entre varias edades candidatas. Usado para medir
  // la tasa histórica de cosecha por edad sin sobre-contar.
  async getCosechadoPorFincaCohorte({ fincaIds, semanaEmbolseIds }) {
    if (semanaEmbolseIds.length === 0) return [];

    const results = await RacimoMovimiento.findAll({
      where: {
        tipo: { [Op.in]: ['PROCESADO', 'RECUSE'] },
        semanaEmbolseId: { [Op.in]: semanaEmbolseIds },
        ...(fincaIds ? { fincaId: { [Op.in]: fincaIds } } : {}),
      },
      attributes: ['fincaId', 'semanaEmbolseId', 'semanaRegistroId', [fn('SUM', col('cantidad')), 'total']],
      group: ['fincaId', 'semanaEmbolseId', 'semanaRegistroId'],
      raw: true,
    });

    return results.map((r) => ({
      fincaId: r.fincaId,
      semanaEmbolseId: r.semanaEmbolseId,
      semanaRegistroId: r.semanaRegistroId,
      total: Number(r.total),
    }));
  },

  // Igual que getEmbolsePorSemana, pero agrupado también por finca — el
  // pronóstico necesita el pipeline de embolses por edad de cada finca por
  // separado, no solo el total agregado. `tipo`/`campo` por defecto EMBOLSE/
  // semanaEmbolseId (así pronóstico.service.js, que la llama sin pasarlos,
  // sigue igual). `semanaEmbolseIds` sigue con ese nombre por compatibilidad
  // con ese llamador, aunque con `campo: 'semanaRegistroId'` en realidad son
  // ids de semanas de registro — misma tabla `semanas`, mismo tipo de id.
  async getEmbolsePorFincaYSemana({ fincaIds, semanaEmbolseIds, tipo = 'EMBOLSE', campo = 'semanaEmbolseId', motivoRepiqueId }) {
    if (semanaEmbolseIds.length === 0) return new Map();

    const results = await RacimoMovimiento.findAll({
      where: {
        tipo,
        [campo]: { [Op.in]: semanaEmbolseIds },
        ...(fincaIds ? { fincaId: { [Op.in]: fincaIds } } : {}),
        ...(motivoRepiqueId ? { motivoRepiqueId: Array.isArray(motivoRepiqueId) ? { [Op.in]: motivoRepiqueId } : motivoRepiqueId } : {}),
      },
      attributes: ['fincaId', campo, [fn('SUM', col('cantidad')), 'total']],
      group: ['fincaId', campo],
      raw: true,
    });

    const map = new Map();
    for (const r of results) map.set(`${r.fincaId}-${r[campo]}`, Number(r.total));
    return map;
  },

  // Total por finca (sumado, no por semana) de un tipo de movimiento en las
  // semanas dadas — para el ranking de fincas del Gráfico de
  // Embolses/Repiques.
  async getEmbolseTotalPorFinca({ fincaIds, semanaEmbolseIds, tipo = 'EMBOLSE', campo = 'semanaEmbolseId', motivoRepiqueId }) {
    if (semanaEmbolseIds.length === 0) return new Map();

    const results = await RacimoMovimiento.findAll({
      where: {
        tipo,
        [campo]: { [Op.in]: semanaEmbolseIds },
        ...(fincaIds ? { fincaId: { [Op.in]: fincaIds } } : {}),
        ...(motivoRepiqueId ? { motivoRepiqueId: Array.isArray(motivoRepiqueId) ? { [Op.in]: motivoRepiqueId } : motivoRepiqueId } : {}),
      },
      attributes: ['fincaId', [fn('SUM', col('cantidad')), 'total']],
      group: ['fincaId'],
      raw: true,
    });

    const map = new Map();
    for (const r of results) map.set(r.fincaId, Number(r.total));
    return map;
  },

  // Total por MOTIVO de repique (sumado, no por semana ni por finca) — para
  // el gráfico de barras de "Gráfico de Repiques". Siempre trae todos los
  // motivos del alcance filtrado, sin aplicar el motivo seleccionado (si lo
  // hay) — igual que un gráfico de barras en Power BI, que se queda mostrando
  // todas las categorías aunque una esté marcada como filtro activo.
  async getTotalPorMotivoRepique({ fincaIds, semanaIds, campo = 'semanaRegistroId' }) {
    if (semanaIds.length === 0) return [];

    const results = await RacimoMovimiento.findAll({
      where: {
        tipo: 'REPIQUE',
        [campo]: { [Op.in]: semanaIds },
        ...(fincaIds ? { fincaId: { [Op.in]: fincaIds } } : {}),
      },
      attributes: ['motivoRepiqueId', [fn('SUM', col('cantidad')), 'total']],
      group: ['motivoRepiqueId'],
      include: [{ model: MotivoRepique, as: 'motivoRepique', attributes: ['uuid', 'nombre'] }],
      raw: true,
      nest: true,
    });

    return results
      .filter((r) => r.motivoRepique)
      .map((r) => ({ uuid: r.motivoRepique.uuid, nombre: r.motivoRepique.nombre, total: Number(r.total) }));
  },

  async update(movimiento, data, { transaction } = {}) {
    await movimiento.update(data, { transaction });
    return movimiento;
  },

  async softDelete(movimiento, deletedBy, { transaction } = {}) {
    await movimiento.update({ deletedBy }, { transaction });
    await movimiento.destroy({ transaction });
    return movimiento;
  },

  async findAllForExport({
    fincaId,
    fincaIds,
    loteId,
    semanaEmbolseId,
    semanaRegistroId,
    semanaRegistroIds,
    usuarioId,
    tipo,
    fechaDesde,
    fechaHasta,
  }) {
    const where = {
      ...(fincaId ? { fincaId } : fincaIds ? { fincaId: { [Op.in]: fincaIds } } : {}),
      ...(loteId ? { loteId } : {}),
      ...(semanaEmbolseId ? { semanaEmbolseId } : {}),
      ...(semanaRegistroIds ? { semanaRegistroId: { [Op.in]: semanaRegistroIds } } : semanaRegistroId ? { semanaRegistroId } : {}),
      ...(usuarioId ? { createdBy: usuarioId } : {}),
      ...(tipo ? { tipo } : {}),
      ...(fechaDesde || fechaHasta
        ? {
            fecha: {
              ...(fechaDesde ? { [Op.gte]: fechaDesde } : {}),
              ...(fechaHasta ? { [Op.lte]: fechaHasta } : {}),
            },
          }
        : {}),
    };

    return RacimoMovimiento.findAll({
      where,
      include: listIncludes,
      order: [['fecha', 'DESC'], ['id', 'DESC']],
    });
  },

  // Suma con signo de todos los movimientos de una cohorte (finca + lote +
  // semana de embolse): EMBOLSE suma, el resto resta. `excludeId` se usa al
  // editar un movimiento, para no contarlo dos veces contra sí mismo.
  async getSaldoCohorte({ fincaId, loteId, semanaEmbolseId }, { excludeId } = {}) {
    const [result] = await RacimoMovimiento.findAll({
      where: {
        fincaId,
        loteId,
        semanaEmbolseId,
        ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}),
      },
      attributes: [[fn('COALESCE', fn('SUM', literal("CASE WHEN tipo = 'EMBOLSE' THEN cantidad ELSE -cantidad END")), 0), 'saldo']],
      raw: true,
    });
    return Number(result.saldo);
  },

  // Última semana de registro usada por cada finca (la de fecha_inicio más
  // reciente entre todos sus movimientos) — para impedir que un usuario
  // no-administrador registre movimientos "hacia atrás" respecto de dónde
  // va esa finca. Devuelve un Map fincaId -> { semanaRegistroId, codigo,
  // fechaInicio }.
  async getUltimaSemanaRegistroPorFinca(fincaIds) {
    if (fincaIds.length === 0) return new Map();

    const rows = await RacimoMovimiento.findAll({
      where: { fincaId: { [Op.in]: fincaIds } },
      attributes: ['fincaId', 'semanaRegistroId'],
      include: [{ model: Semana, as: 'semanaRegistro', attributes: ['id', 'uuid', 'codigo', 'fechaInicio'] }],
      raw: true,
      nest: true,
    });

    const map = new Map();
    for (const r of rows) {
      const actual = map.get(r.fincaId);
      if (!actual || r.semanaRegistro.fechaInicio > actual.fechaInicio) {
        map.set(r.fincaId, {
          id: r.semanaRegistroId,
          uuid: r.semanaRegistro.uuid,
          codigo: r.semanaRegistro.codigo,
          fechaInicio: r.semanaRegistro.fechaInicio,
        });
      }
    }
    return map;
  },

  // Desglose por tipo de una cohorte (finca + lote + semana de embolse),
  // para mostrar el resumen antes de registrar un nuevo movimiento.
  async getResumenCohorte({ fincaId, loteId, semanaEmbolseId }) {
    const movimientos = await RacimoMovimiento.findAll({
      where: { fincaId, loteId, semanaEmbolseId },
      attributes: ['tipo', 'cantidad'],
    });

    const resumen = { totalEmbolsado: 0, totalRepicado: 0, totalRecusado: 0, totalProcesado: 0 };
    for (const m of movimientos) {
      if (m.tipo === 'EMBOLSE') resumen.totalEmbolsado += m.cantidad;
      else if (m.tipo === 'REPIQUE') resumen.totalRepicado += m.cantidad;
      else if (m.tipo === 'RECUSE') resumen.totalRecusado += m.cantidad;
      else if (m.tipo === 'PROCESADO') resumen.totalProcesado += m.cantidad;
    }
    resumen.saldo = resumen.totalEmbolsado - resumen.totalRepicado - resumen.totalRecusado - resumen.totalProcesado;
    return resumen;
  },

  // Todos los movimientos de las cohortes dadas, con finca y lote, para
  // construir el reporte de saldos por lotes y cintas en una sola consulta.
  // Suma por cohorte (semanaEmbolseId) y tipo, de TODOS los movimientos con
  // semana de registro ANTERIOR a `fechaLimite` (fecha_inicio de la semana
  // de registro elegida) — para calcular el "saldo inicial" de esa semana
  // en getReporteMovimientosSemana. Agrega en SQL (no trae fila por fila)
  // porque el historial completo puede ser de años.
  async sumarPorCohorteAntesDe({ semanaEmbolseIds, fincaId, fincaIds, fechaLimite }) {
    if (semanaEmbolseIds.length === 0) return [];
    const filas = await RacimoMovimiento.findAll({
      attributes: ['semanaEmbolseId', 'tipo', [fn('SUM', col('cantidad')), 'total']],
      where: {
        semanaEmbolseId: { [Op.in]: semanaEmbolseIds },
        ...(fincaId ? { fincaId } : fincaIds ? { fincaId: { [Op.in]: fincaIds } } : {}),
      },
      include: [{ model: Semana, as: 'semanaRegistro', attributes: [], where: { fechaInicio: { [Op.lt]: fechaLimite } }, required: true }],
      group: ['semanaEmbolseId', 'tipo'],
      raw: true,
    });
    return filas.map((f) => ({ semanaEmbolseId: f.semanaEmbolseId, tipo: f.tipo, total: Number(f.total) }));
  },

  // Última semana de REGISTRO que efectivamente tiene movimientos de
  // racimos (dentro del alcance de fincas dado, y opcionalmente acotada a un
  // año) — para que "Detalle Semanal" abra por defecto en la última semana
  // con datos reales, en vez de la semana calendario de hoy (que puede no
  // tener nada cargado todavía).
  async getUltimaSemanaConMovimientos({ fincaIds, anio }) {
    const fila = await RacimoMovimiento.findOne({
      where: {
        ...(fincaIds ? { fincaId: { [Op.in]: fincaIds } } : {}),
      },
      include: [
        {
          model: Semana,
          as: 'semanaRegistro',
          attributes: ['id', 'uuid', 'codigo', 'anio', 'numeroSemana', 'color', 'fechaInicio'],
          where: anio ? { anio } : undefined,
          required: true,
        },
      ],
      order: [[{ model: Semana, as: 'semanaRegistro' }, 'fechaInicio', 'DESC']],
    });
    return fila ? fila.semanaRegistro : null;
  },

  // Igual que sumarPorCohorteAntesDe, pero desglosado también por lote — para
  // poder expandir las filas "Saldo Inicial"/"Saldo Final" de
  // getReporteMovimientosSemana y mostrar de qué lote viene cada saldo.
  async sumarPorLoteYCohorteAntesDe({ semanaEmbolseIds, fincaId, fincaIds, fechaLimite }) {
    if (semanaEmbolseIds.length === 0) return [];
    const filas = await RacimoMovimiento.findAll({
      attributes: ['loteId', 'semanaEmbolseId', 'tipo', [fn('SUM', col('cantidad')), 'total']],
      where: {
        semanaEmbolseId: { [Op.in]: semanaEmbolseIds },
        ...(fincaId ? { fincaId } : fincaIds ? { fincaId: { [Op.in]: fincaIds } } : {}),
      },
      include: [{ model: Semana, as: 'semanaRegistro', attributes: [], where: { fechaInicio: { [Op.lt]: fechaLimite } }, required: true }],
      group: ['loteId', 'semanaEmbolseId', 'tipo'],
      raw: true,
    });
    return filas.map((f) => ({ loteId: f.loteId, semanaEmbolseId: f.semanaEmbolseId, tipo: f.tipo, total: Number(f.total) }));
  },

  findConFincaYLote({ semanaEmbolseIds, fincaId, fincaIds, semanaRegistroId }) {
    const where = {
      semanaEmbolseId: { [Op.in]: semanaEmbolseIds },
      ...(fincaId ? { fincaId } : fincaIds ? { fincaId: { [Op.in]: fincaIds } } : {}),
      ...(semanaRegistroId ? { semanaRegistroId } : {}),
    };
    return RacimoMovimiento.findAll({
      where,
      attributes: ['fincaId', 'loteId', 'semanaEmbolseId', 'tipo', 'cantidad'],
      include: [
        { model: Finca, as: 'finca', attributes: ['id', 'uuid', 'codigo', 'nombre'] },
        { model: Lote, as: 'lote', attributes: ['id', 'uuid', 'codigo', 'nombre'] },
      ],
    });
  },

  // Movimientos crudos de las cohortes solicitadas, para que el servicio los
  // agrupe y calcule los totales del inventario.
  findMovimientosParaInventario({ fincaId, fincaIds, loteId, semanaEmbolseIds }) {
    return RacimoMovimiento.findAll({
      where: {
        semanaEmbolseId: { [Op.in]: semanaEmbolseIds },
        ...(fincaId ? { fincaId } : fincaIds ? { fincaId: { [Op.in]: fincaIds } } : {}),
        ...(loteId ? { loteId } : {}),
      },
      attributes: ['fincaId', 'loteId', 'semanaEmbolseId', 'tipo', 'cantidad'],
      include: [
        { model: Finca, as: 'finca', attributes: ['id', 'uuid', 'codigo', 'nombre'] },
        { model: Lote, as: 'lote', attributes: ['id', 'uuid', 'codigo', 'nombre'] },
      ],
      raw: false,
    });
  },
};

export default racimoMovimientoRepository;
