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
  { model: Semana, as: 'semanaEmbolse', attributes: ['id', 'uuid', 'codigo', 'anio', 'numeroSemana', 'color'] },
  { model: Semana, as: 'semanaRegistro', attributes: ['id', 'uuid', 'codigo', 'anio', 'numeroSemana', 'color'] },
  { model: MotivoRepique, as: 'motivoRepique', attributes: ['id', 'uuid', 'nombre'] },
  { model: MotivoRecuse, as: 'motivoRecuse', attributes: ['id', 'uuid', 'nombre'] },
  { model: User, as: 'creadoPor', attributes: ['id', 'uuid', 'usuario', 'nombre'] },
];

export const racimoMovimientoRepository = {
  async findAndCountAll({
    limit,
    offset,
    fincaId,
    loteId,
    semanaEmbolseId,
    semanaRegistroId,
    tipo,
    fechaDesde,
    fechaHasta,
  }) {
    const where = {
      ...(fincaId ? { fincaId } : {}),
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

  async update(movimiento, data, { transaction } = {}) {
    await movimiento.update(data, { transaction });
    return movimiento;
  },

  async softDelete(movimiento, deletedBy, { transaction } = {}) {
    await movimiento.update({ deletedBy }, { transaction });
    await movimiento.destroy({ transaction });
    return movimiento;
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
  findConFincaYLote({ semanaEmbolseIds, fincaId }) {
    const where = {
      semanaEmbolseId: { [Op.in]: semanaEmbolseIds },
      ...(fincaId ? { fincaId } : {}),
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
  findMovimientosParaInventario({ fincaId, loteId, semanaEmbolseIds }) {
    return RacimoMovimiento.findAll({
      where: {
        semanaEmbolseId: { [Op.in]: semanaEmbolseIds },
        ...(fincaId ? { fincaId } : {}),
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
