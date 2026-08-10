import { Op, literal } from 'sequelize';
import { Lote, Planta } from '../../database/associations.js';

// Orden natural por `nombre` (1, 2, 3, ... 10, 11) en vez del alfabético
// (1, 11, 12, ..., 2). `codigo` desempata nombres repetidos.
const ORDEN_NUMERICO = [[literal('CAST(`Lote`.`nombre` AS UNSIGNED)'), 'ASC'], ['codigo', 'ASC']];

export const loteRepository = {
  async findAndCountAll({ limit, offset, search, fincaId, fincaIdsPermitidas }) {
    const where = {
      ...(fincaId ? { fincaId } : fincaIdsPermitidas ? { fincaId: { [Op.in]: fincaIdsPermitidas } } : {}),
      ...(search
        ? {
            [Op.or]: [
              { codigo: { [Op.like]: `%${search}%` } },
              { nombre: { [Op.like]: `%${search}%` } },
            ],
          }
        : {}),
    };

    return Lote.findAndCountAll({ where, limit, offset, order: ORDEN_NUMERICO });
  },

  findByUuid(uuid) {
    return Lote.findOne({ where: { uuid } });
  },

  // Incluye lotes eliminados lógicamente — necesario para poder
  // encontrarlos y restaurarlos (findByUuid los excluye por ser paranoid).
  findByUuidIncludingDeleted(uuid) {
    return Lote.findOne({ where: { uuid }, paranoid: false });
  },

  findById(id) {
    return Lote.findByPk(id);
  },

  findByFincaAndCodigo(fincaId, codigo) {
    return Lote.findOne({ where: { fincaId, codigo } });
  },

  findByFincaAndNombre(fincaId, nombre, { excludeId } = {}) {
    return Lote.findOne({
      where: { fincaId, nombre, ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}) },
    });
  },

  // Incluye lotes eliminados lógicamente: el UNIQUE de `codigo` en la BD no
  // distingue registros con soft-delete, así que hay que revisar esto antes
  // de asignar un código para no chocar con la restricción.
  findByFincaAndCodigoIncludingDeleted(fincaId, codigo) {
    return Lote.findOne({ where: { fincaId, codigo }, paranoid: false });
  },

  // Cuenta TODOS los lotes de la finca, incluidos los eliminados
  // lógicamente, para generar un consecutivo que nunca se repita.
  countByFincaId(fincaId) {
    return Lote.count({ where: { fincaId }, paranoid: false });
  },

  // Códigos ya usados por cualquiera de las fincas dadas, incluidos los
  // lotes eliminados lógicamente (para calcular consecutivos libres en
  // memoria sin una consulta por fila).
  findCodigosByFincaIds(fincaIds) {
    return Lote.findAll({
      where: { fincaId: { [Op.in]: fincaIds } },
      attributes: ['fincaId', 'codigo'],
      paranoid: false,
    });
  },

  // Igual que findCodigosByFincaIds pero de `nombre` — para detectar
  // duplicados de nombre dentro de una finca en el cargue masivo (no
  // incluye eliminados lógicamente: un nombre de un lote borrado sí se
  // puede reutilizar).
  findNombresByFincaIds(fincaIds) {
    return Lote.findAll({
      where: { fincaId: { [Op.in]: fincaIds } },
      attributes: ['fincaId', 'nombre'],
    });
  },

  create(data, { transaction } = {}) {
    return Lote.create(data, { transaction });
  },

  bulkCreate(rows) {
    return Lote.bulkCreate(rows);
  },

  async update(lote, data, { transaction } = {}) {
    await lote.update(data, { transaction });
    return lote;
  },

  async softDelete(lote, deletedBy, { transaction } = {}) {
    await lote.update({ deletedBy }, { transaction });
    await lote.destroy({ transaction });
    return lote;
  },

  async restore(lote, { transaction } = {}) {
    await lote.restore({ transaction });
    await lote.update({ deletedBy: null }, { transaction });
    return lote;
  },

  findPlantasByLoteId(loteId, { limit, offset } = {}) {
    return Planta.findAndCountAll({ where: { loteId }, limit, offset, order: [['id', 'ASC']] });
  },
};

export default loteRepository;
