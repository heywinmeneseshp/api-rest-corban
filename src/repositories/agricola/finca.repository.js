import { Op, literal } from 'sequelize';
import { Finca, Lote, GrupoFinca } from '../../database/associations.js';

const INCLUDE_GRUPO = [{ model: GrupoFinca, as: 'grupoFinca' }];

export const fincaRepository = {
  async findAndCountAll({ limit, offset, search, fincaIdsPermitidas, soloOperativas }) {
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
      ...(soloOperativas ? { esExterna: false } : {}),
    };

    return Finca.findAndCountAll({ where, limit, offset, order: [['id', 'ASC']], include: INCLUDE_GRUPO });
  },

  findByUuid(uuid) {
    return Finca.findOne({ where: { uuid }, include: INCLUDE_GRUPO });
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

  // `fincaIds`: arreglo (puede ser un solo elemento, o varios si la finca
  // pertenece a un Grupo de Finca — ver utils/fincaScope.js).
  findLotesByFincaIds(fincaIds, { limit, offset, incluirEliminados = false } = {}) {
    return Lote.findAndCountAll({
      where: { fincaId: { [Op.in]: fincaIds } },
      limit,
      offset,
      // `codigo` es un identificador interno (prefijo de finca + correlativo
      // de creación, ej. "513-07") que no coincide con el número de lote
      // real que ve el usuario (`nombre`, ej. "7") — ordenar por `codigo`
      // deja los lotes fuera de orden numérico, más notorio todavía cuando
      // se combinan lotes de varias fincas de un mismo Grupo de Finca. Se
      // ordena por `nombre` interpretado como número (CAST numérico), con
      // `codigo` como desempate estable para nombres repetidos (ej. lotes
      // resembrados que reusan el mismo número).
      order: [[literal('CAST(`Lote`.`nombre` AS UNSIGNED)'), 'ASC'], ['codigo', 'ASC']],
      // paranoid:false trae también los soft-deleted (junto con los
      // activos) — cada fila expone `deletedAt` para que el frontend
      // pueda distinguirlos.
      paranoid: !incluirEliminados,
    });
  },
};

export default fincaRepository;
