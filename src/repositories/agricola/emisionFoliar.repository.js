import { EmisionFoliar } from '../../database/associations.js';

export const emisionFoliarRepository = {
  findByEvaluacionId(evaluacionId) {
    return EmisionFoliar.findOne({ where: { evaluacionId } });
  },

  create(data, { transaction } = {}) {
    return EmisionFoliar.create(data, { transaction });
  },

  async update(emision, data, { transaction } = {}) {
    await emision.update(data, { transaction });
    return emision;
  },
};

export default emisionFoliarRepository;
