import { Op, fn, col } from 'sequelize';
import { ProduccionSemanal, Finca, Semana } from '../../database/associations.js';

const listIncludes = [
  { model: Finca, as: 'finca', attributes: ['id', 'uuid', 'codigo', 'nombre'] },
  { model: Semana, as: 'semana', attributes: ['id', 'uuid', 'codigo', 'anio', 'numeroSemana'] },
];

export const produccionSemanalRepository = {
  async findAndCountAll({ limit, offset, fincaId, fincaIds, semanaId }) {
    const where = {
      ...(fincaId ? { fincaId } : fincaIds ? { fincaId: { [Op.in]: fincaIds } } : {}),
      ...(semanaId ? { semanaId } : {}),
    };

    // Ordenar por año/número de semana real, no por `semanaId` (el id
    // interno de la tabla semanas solo refleja cuándo se creó esa fila, no
    // el orden cronológico — una carga histórica tardía puede tener un id
    // más alto que semanas más recientes ya existentes).
    return ProduccionSemanal.findAndCountAll({
      where,
      include: listIncludes,
      limit,
      offset,
      order: [
        [{ model: Semana, as: 'semana' }, 'anio', 'DESC'],
        [{ model: Semana, as: 'semana' }, 'numeroSemana', 'DESC'],
        ['fincaId', 'ASC'],
      ],
      distinct: true,
    });
  },

  bulkCreate(dataArray, { transaction } = {}) {
    return ProduccionSemanal.bulkCreate(dataArray, { transaction });
  },

  // Inserta las que no existen y sobrescribe `cajas20kg` de las que ya
  // existen para esa finca+semana (mismo índice único que usa el cargue
  // normal para detectar duplicados) — una sola sentencia, sin transacción
  // aparte porque ya es atómica a nivel de esa sentencia.
  bulkUpsert(dataArray, { transaction } = {}) {
    return ProduccionSemanal.bulkCreate(dataArray, {
      updateOnDuplicate: ['cajas20kg', 'updatedBy'],
      transaction,
    });
  },

  findByUuid(uuid) {
    return ProduccionSemanal.findOne({ where: { uuid }, include: listIncludes });
  },

  async softDelete(registro, deletedBy, { transaction } = {}) {
    await registro.update({ deletedBy }, { transaction });
    await registro.destroy({ transaction });
    return registro;
  },

  // Cuando Programación de Corte de una finca+semana se queda sin filas
  // (se borró la última), ya no hay nada que calcular — se borra el
  // registro calculado en vez de dejar un valor viejo dando vueltas.
  async deleteByFincaYSemana(fincaId, semanaId, deletedBy, { transaction } = {}) {
    await ProduccionSemanal.update({ deletedBy }, { where: { fincaId, semanaId }, transaction });
    await ProduccionSemanal.destroy({ where: { fincaId, semanaId }, transaction });
  },

  async findAllBySemanaYFinca({ semanaIds, fincaIds }) {
    return ProduccionSemanal.findAll({
      where: {
        semanaId: { [Op.in]: semanaIds },
        fincaId: { [Op.in]: fincaIds },
      },
      include: listIncludes,
      raw: false,
    });
  },

  // Cajas 20kg agregadas por finca y semana, para el pronóstico y para
  // calcular el ratio histórico real (cajas ÷ racimos cosechados). No existe
  // hoy ningún método que agregue esto entre varias fincas a la vez.
  async getCajasPorFincaYSemana({ fincaIds, semanaIds }) {
    if (semanaIds.length === 0) return new Map();

    const results = await ProduccionSemanal.findAll({
      where: {
        semanaId: { [Op.in]: semanaIds },
        ...(fincaIds ? { fincaId: { [Op.in]: fincaIds } } : {}),
      },
      attributes: ['fincaId', 'semanaId', [fn('SUM', col('cajas_20kg')), 'total']],
      group: ['fincaId', 'semanaId'],
      raw: true,
    });

    const map = new Map();
    for (const r of results) map.set(`${r.fincaId}-${r.semanaId}`, Number(r.total));
    return map;
  },
};

export default produccionSemanalRepository;
