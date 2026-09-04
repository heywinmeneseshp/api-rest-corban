import { Op } from 'sequelize';
import { ObjetivoEvaluacion, TipoEvaluacion, Finca, Lote } from '../../database/associations.js';

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
  findAndCountAll({ limit, offset, fincaId, loteId, tipoEvaluacionId }) {
    const where = {};
    if (fincaId) where.fincaId = fincaId;
    if (loteId) where.loteId = loteId;
    if (tipoEvaluacionId) where.tipoEvaluacionId = tipoEvaluacionId;
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
