import { LoteAreaConfig, Finca, Role } from '../../database/associations.js';

const INCLUDE_COMPLETO = [
  { model: Finca, as: 'finca', attributes: ['id', 'uuid', 'codigo', 'nombre'] },
  { model: Role, as: 'rol', attributes: ['id', 'uuid', 'nombre'] },
];

export const loteAreaConfigRepository = {
  findAndCountAll({ limit, offset }) {
    return LoteAreaConfig.findAndCountAll({
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: INCLUDE_COMPLETO,
    });
  },

  findByUuid(uuid) {
    return LoteAreaConfig.findOne({ where: { uuid }, include: INCLUDE_COMPLETO });
  },

  findActivas() {
    return LoteAreaConfig.findAll({ where: { activo: true }, include: INCLUDE_COMPLETO });
  },

  create(data, { transaction } = {}) {
    return LoteAreaConfig.create(data, { transaction });
  },

  async update(config, data, { transaction } = {}) {
    await config.update(data, { transaction });
    return config;
  },

  async softDelete(config, deletedBy, { transaction } = {}) {
    await config.update({ deletedBy }, { transaction });
    await config.destroy({ transaction });
    return config;
  },
};

export default loteAreaConfigRepository;
