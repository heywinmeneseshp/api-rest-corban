import { Op } from 'sequelize';
import {
  RacimoMovimiento,
  Finca,
  Lote,
  Semana,
  MotivoRepique,
  MotivoRecuse,
} from '../../database/associations.js';

const listIncludes = [
  { model: Finca, as: 'finca', attributes: ['id', 'uuid', 'codigo', 'nombre'] },
  { model: Lote, as: 'lote', attributes: ['id', 'uuid', 'codigo', 'nombre'] },
  { model: Semana, as: 'semanaEmbolse', attributes: ['id', 'uuid', 'codigo', 'anio', 'numeroSemana'] },
  { model: Semana, as: 'semanaRegistro', attributes: ['id', 'uuid', 'codigo', 'anio', 'numeroSemana'] },
  { model: MotivoRepique, as: 'motivoRepique', attributes: ['id', 'uuid', 'nombre'] },
  { model: MotivoRecuse, as: 'motivoRecuse', attributes: ['id', 'uuid', 'nombre'] },
];

export const racimoMovimientoRepository = {
  async findAndCountAll({ limit, offset, fincaId, loteId, semanaEmbolseId, tipo, fechaDesde, fechaHasta }) {
    const where = {
      ...(fincaId ? { fincaId } : {}),
      ...(loteId ? { loteId } : {}),
      ...(semanaEmbolseId ? { semanaEmbolseId } : {}),
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
    const movimientos = await RacimoMovimiento.findAll({
      where: {
        fincaId,
        loteId,
        semanaEmbolseId,
        ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}),
      },
      attributes: ['tipo', 'cantidad'],
    });

    return movimientos.reduce(
      (saldo, m) => (m.tipo === 'EMBOLSE' ? saldo + m.cantidad : saldo - m.cantidad),
      0,
    );
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
      else if (m.tipo === 'CORTE') resumen.totalProcesado += m.cantidad;
    }
    resumen.saldo = resumen.totalEmbolsado - resumen.totalRepicado - resumen.totalRecusado - resumen.totalProcesado;
    return resumen;
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
