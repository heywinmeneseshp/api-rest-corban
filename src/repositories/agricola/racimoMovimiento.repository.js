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
    tipo,
    fechaDesde,
    fechaHasta,
  }) {
    const where = {
      ...(fincaId ? { fincaId } : fincaIds ? { fincaId: { [Op.in]: fincaIds } } : {}),
      ...(loteId ? { loteId } : {}),
      ...(semanaEmbolseId ? { semanaEmbolseId } : {}),
      ...(semanaRegistroId ? { semanaRegistroId } : {}),
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

  // Total embolsado por semana (de embolse), para el gráfico de embolses
  // del año. `semanaIds` son las semanas del año consultado; `fincaId` es
  // opcional (si no se da, suma todas las fincas).
  async getEmbolsePorSemana({ semanaIds, fincaId, fincaIds }) {
    if (semanaIds.length === 0) return new Map();

    const results = await RacimoMovimiento.findAll({
      where: {
        tipo: 'EMBOLSE',
        semanaEmbolseId: { [Op.in]: semanaIds },
        ...(fincaId ? { fincaId } : fincaIds ? { fincaId: { [Op.in]: fincaIds } } : {}),
      },
      attributes: ['semanaEmbolseId', [fn('SUM', col('cantidad')), 'total']],
      group: ['semanaEmbolseId'],
      raw: true,
    });

    const map = new Map();
    for (const r of results) map.set(r.semanaEmbolseId, Number(r.total));
    return map;
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

  async findAllForExport({ fincaId, fincaIds, loteId, semanaEmbolseId, semanaRegistroId, tipo, fechaDesde, fechaHasta }) {
    const where = {
      ...(fincaId ? { fincaId } : fincaIds ? { fincaId: { [Op.in]: fincaIds } } : {}),
      ...(loteId ? { loteId } : {}),
      ...(semanaEmbolseId ? { semanaEmbolseId } : {}),
      ...(semanaRegistroId ? { semanaRegistroId } : {}),
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
      include: [{ model: Semana, as: 'semanaRegistro', attributes: ['id', 'codigo', 'fechaInicio'] }],
      raw: true,
      nest: true,
    });

    const map = new Map();
    for (const r of rows) {
      const actual = map.get(r.fincaId);
      if (!actual || r.semanaRegistro.fechaInicio > actual.fechaInicio) {
        map.set(r.fincaId, {
          semanaRegistroId: r.semanaRegistroId,
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
  findConFincaYLote({ semanaEmbolseIds, fincaId, fincaIds }) {
    const where = {
      semanaEmbolseId: { [Op.in]: semanaEmbolseIds },
      ...(fincaId ? { fincaId } : fincaIds ? { fincaId: { [Op.in]: fincaIds } } : {}),
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
