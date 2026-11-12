import { Op } from 'sequelize';
import { ObjetivoEvaluacion, TipoEvaluacion, Finca, Lote } from '../../database/associations.js';
import { sequelize } from '../../database/connection.js';

const includeDefault = [
  { model: TipoEvaluacion, as: 'tipoEvaluacion', attributes: ['id', 'uuid', 'nombre'] },
  { model: Finca, as: 'finca', attributes: ['id', 'uuid', 'codigo', 'nombre'] },
  {
    model: Lote,
    as: 'lote',
    attributes: ['id', 'uuid', 'codigo', 'nombre'],
    include: [{ model: Finca, as: 'finca', attributes: ['id', 'uuid', 'codigo', 'nombre'] }],
  },
];

export const objetivoEvaluacionRepository = {
  // Condición de alcance: objetivos de las fincas permitidas y de los lotes de esas fincas. `fincaIds` null = sin restricción.
  condicionAlcance(fincaIds) {
    if (!fincaIds) return null;
    const ids = fincaIds.length ? fincaIds.map(Number).join(',') : 'NULL';
    return { [Op.or]: [{ fincaId: { [Op.in]: fincaIds } }, { loteId: { [Op.in]: sequelize.literal(`(SELECT id FROM lotes WHERE finca_id IN (${ids}))`) } }] };
  },

  findAndCountAll({ limit, offset, fincaId, loteId, tipoEvaluacionId, estado, fincaIds }) {
    const where = {};
    if (fincaId) where.fincaId = fincaId;
    if (loteId) where.loteId = loteId;
    if (tipoEvaluacionId) where.tipoEvaluacionId = tipoEvaluacionId;
    if (estado !== undefined) where.estado = estado;
    const alcance = this.condicionAlcance(fincaIds);
    if (alcance) where[Op.and] = [alcance];
    return ObjetivoEvaluacion.findAndCountAll({
      where,
      limit,
      offset,
      order: [['id', 'DESC']],
      include: includeDefault,
      distinct: true,
    });
  },

  findByUuid(uuid) {
    return ObjetivoEvaluacion.findOne({ where: { uuid }, include: includeDefault });
  },

  findById(id) {
    return ObjetivoEvaluacion.findByPk(id);
  },

  // Objetivos activos aplicables a una finca y/o un lote puntual — un lote
  // puede tener su propio objetivo Y heredar el de su finca; se devuelven
  // ambos, sin fusionar.
  findAplicables({ fincaId, loteId }) {
    const or = [];
    if (fincaId) or.push({ fincaId });
    if (loteId) or.push({ loteId });
    if (or.length === 0) return Promise.resolve([]);
    return ObjetivoEvaluacion.findAll({
      where: { estado: true, [Op.or]: or },
      include: includeDefault,
    });
  },

  // Objetivos de un mismo tipo y ámbito (finca o lote). `soloActivos`: solo estado = true.
  findPorTipoYAmbito({ tipoEvaluacionId, fincaId, loteId, soloActivos = false }, { transaction } = {}) {
    return ObjetivoEvaluacion.findAll({
      where: { tipoEvaluacionId, fincaId: fincaId ?? null, loteId: loteId ?? null, ...(soloActivos ? { estado: true } : {}) },
      order: [['id', 'ASC']],
      transaction,
    });
  },

  // Todos los objetivos activos (para la matriz), restringidos por alcance.
  findActivos({ fincaIds } = {}) {
    const alcance = this.condicionAlcance(fincaIds);
    return ObjetivoEvaluacion.findAll({
      where: { estado: true, ...(alcance ? { [Op.and]: [alcance] } : {}) },
      order: [['id', 'ASC']],
    });
  },

  // Todos los objetivos activos con tipo, finca y lote (para el aviso semanal de incumplimiento).
  findActivosConDetalle() {
    return ObjetivoEvaluacion.findAll({ where: { estado: true }, include: includeDefault, order: [['id', 'ASC']] });
  },

  create(data, { transaction } = {}) {
    return ObjetivoEvaluacion.create(data, { transaction });
  },

  async update(objetivo, data, { transaction } = {}) {
    await objetivo.update(data, { transaction });
    return objetivo;
  },

  async softDelete(objetivo, deletedBy, { transaction } = {}) {
    await objetivo.update({ deletedBy }, { transaction });
    await objetivo.destroy({ transaction });
    return objetivo;
  },
};

export default objetivoEvaluacionRepository;
