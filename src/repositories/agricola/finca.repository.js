import { Op } from 'sequelize';
import { Finca, Lote } from '../../database/associations.js';

export const fincaRepository = {
  async findAndCountAll({ limit, offset, search, fincaIdsPermitidas }) {
    const where = {
      ...(search
        ? {
            [Op.or]: [
              { codigo: { [Op.like]: `%${search}%` } },
              { nombre: { [Op.like]: `%${search}%` } },
            ],
          }
        : {}),
      ...(fincaIdsPermitidas ? { id: { [Op.in]: fincaIdsPermitidas } } : {}),
    };

    return Finca.findAndCountAll({ where, limit, offset, order: [['id', 'ASC']] });
  },

  findByUuid(uuid) {
    return Finca.findOne({ where: { uuid } });
  },

  findById(id) {
    return Finca.findByPk(id);
  },

  findByCodigo(codigo) {
    return Finca.findOne({ where: { codigo } });
  },

  // Incluye fincas eliminadas lógicamente (paranoid: false). El UNIQUE de
  // `codigo` en la BD no distingue registros con soft-delete, así que hay
  // que revisar esto antes de crear para no chocar con la restricción.
  findByCodigoIncludingDeleted(codigo) {
    return Finca.findOne({ where: { codigo }, paranoid: false });
  },

  findByCodigosIncludingDeleted(codigos) {
    return Finca.findAll({ where: { codigo: { [Op.in]: codigos } }, paranoid: false });
  },

  // Inserta las nuevas, actualiza las existentes y restaura las que estaban
  // borradas lógicamente, todo en una sola sentencia SQL (INSERT ... ON
  // DUPLICATE KEY UPDATE sobre el UNIQUE de `codigo`), en vez de una
  // consulta por fila. Cada fila debe traer `deletedAt: null` para que,
  // si el código coincide con una finca borrada, quede restaurada.
  bulkUpsert(rows) {
    return Finca.bulkCreate(rows, {
      updateOnDuplicate: ['nombre', 'estado', 'deletedAt', 'deletedBy', 'updatedBy'],
    });
  },

  async restore(finca, { transaction } = {}) {
    await finca.restore({ transaction });
    return finca;
  },

  create(data, { transaction } = {}) {
    return Finca.create(data, { transaction });
  },

  async update(finca, data, { transaction } = {}) {
    await finca.update(data, { transaction });
    return finca;
  },

  async softDelete(finca, deletedBy, { transaction } = {}) {
    await finca.update({ deletedBy }, { transaction });
    await finca.destroy({ transaction });
    return finca;
  },

  findLotesByFincaId(fincaId, { limit, offset } = {}) {
    return Lote.findAndCountAll({ where: { fincaId }, limit, offset, order: [['id', 'ASC']] });
  },
};

export default fincaRepository;
