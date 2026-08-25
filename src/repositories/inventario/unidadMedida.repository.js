import { Op } from 'sequelize';
import { UnidadMedida, UnidadConversion } from '../../database/associations.js';

export const unidadMedidaRepository = {
  async findAndCountAll({ limit, offset, search, tipo, estado }) {
    const where = {
      ...(search
        ? {
            [Op.or]: [{ codigo: { [Op.like]: `%${search}%` } }, { nombre: { [Op.like]: `%${search}%` } }, { simbolo: { [Op.like]: `%${search}%` } }],
          }
        : {}),
      ...(tipo ? { tipo } : {}),
      ...(estado !== undefined ? { estado } : {}),
    };
    return UnidadMedida.findAndCountAll({ where, limit, offset, order: [['nombre', 'ASC']] });
  },

  findByUuid(uuid) {
    return UnidadMedida.findOne({ where: { uuid } });
  },

  findByCodigo(codigo) {
    return UnidadMedida.findOne({ where: { codigo } });
  },

  findByCodigoIncludingDeleted(codigo) {
    return UnidadMedida.findOne({ where: { codigo }, paranoid: false });
  },

  create(data, { transaction } = {}) {
    return UnidadMedida.create(data, { transaction });
  },

  async update(unidad, data, { transaction } = {}) {
    await unidad.update(data, { transaction });
    return unidad;
  },

  async softDelete(unidad, deletedBy, { transaction } = {}) {
    await unidad.update({ deletedBy }, { transaction });
    await unidad.destroy({ transaction });
    return unidad;
  },
};

export const unidadConversionRepository = {
  async findByUuid(uuid) {
    return UnidadConversion.findOne({ where: { uuid }, include: [{ model: UnidadMedida, as: 'unidadOrigen' }, { model: UnidadMedida, as: 'unidadDestino' }] });
  },

  async findByPar(uuidOrigen, uuidDestino) {
    // helper para evitar duplicados
    return UnidadConversion.findOne({
      include: [
        { model: UnidadMedida, as: 'unidadOrigen', where: { uuid: uuidOrigen } },
        { model: UnidadMedida, as: 'unidadDestino', where: { uuid: uuidDestino } },
      ],
    });
  },

  create(data, { transaction } = {}) {
    return UnidadConversion.create(data, { transaction });
  },

  async delete(conversion, { transaction } = {}) {
    await conversion.destroy({ transaction });
  },
};

export default unidadMedidaRepository;
