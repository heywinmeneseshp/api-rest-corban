import { Op } from 'sequelize';
import { IngredienteActivo, GrupoQuimico, FracCodigo } from '../../database/associations.js';

// Clasificación FRAC del ingrediente: grupo químico → código FRAC (con modo de acción).
const INCLUDE_FRAC = [
  {
    model: GrupoQuimico,
    as: 'grupoQuimico',
    attributes: ['uuid', 'nombre'],
    required: false,
    include: [{ model: FracCodigo, as: 'frac', attributes: ['uuid', 'codigo', 'modoAccion', 'maxAplicaciones'] }],
  },
];

export const ingredienteActivoRepository = {
  async findAndCountAll({ limit, offset, search, estado }) {
    const where = {
      ...(search
        ? {
            [Op.or]: [
              { nombre: { [Op.like]: `%${search}%` } },
              { descripcion: { [Op.like]: `%${search}%` } },
              { '$grupoQuimico.nombre$': { [Op.like]: `%${search}%` } },
              { '$grupoQuimico.frac.codigo$': { [Op.like]: `%${search}%` } },
            ],
          }
        : {}),
      ...(estado !== undefined ? { estado } : {}),
    };

    return IngredienteActivo.findAndCountAll({ where, limit, offset, order: [['nombre', 'ASC']], include: INCLUDE_FRAC });
  },

  findByUuid(uuid) {
    return IngredienteActivo.findOne({ where: { uuid }, include: INCLUDE_FRAC });
  },

  findById(id) {
    return IngredienteActivo.findByPk(id);
  },

  findByNombre(nombre) {
    return IngredienteActivo.findOne({ where: { nombre } });
  },

  findByNombres(nombres) {
    return IngredienteActivo.findAll({ where: { nombre: { [Op.in]: nombres } } });
  },

  // Inserta los nuevos y actualiza los existentes (por nombre, que es
  // único) en una sola sentencia SQL, en vez de una consulta por fila.
  bulkUpsert(rows) {
    return IngredienteActivo.bulkCreate(rows, {
      updateOnDuplicate: ['descripcion', 'estado', 'updatedBy'],
    });
  },

  create(data, { transaction } = {}) {
    return IngredienteActivo.create(data, { transaction });
  },

  async update(ingrediente, data, { transaction } = {}) {
    await ingrediente.update(data, { transaction });
    return ingrediente;
  },

  async softDelete(ingrediente, deletedBy, { transaction } = {}) {
    await ingrediente.update({ deletedBy }, { transaction });
    await ingrediente.destroy({ transaction });
    return ingrediente;
  },

  // Papelera: solo ingredientes activos eliminados lógicamente. Acceso
  // restringido al rol Administrador desde la ruta (requireAdmin).
  async findAndCountAllDeleted({ limit, offset, search }) {
    const where = {
      deletedAt: { [Op.ne]: null },
      ...(search
        ? { [Op.or]: [{ nombre: { [Op.like]: `%${search}%` } }, { descripcion: { [Op.like]: `%${search}%` } }] }
        : {}),
    };
    return IngredienteActivo.findAndCountAll({ where, limit, offset, order: [['deletedAt', 'DESC']], paranoid: false, include: INCLUDE_FRAC });
  },

  findByUuidIncludingDeleted(uuid) {
    return IngredienteActivo.findOne({ where: { uuid }, paranoid: false });
  },

  async restore(ingrediente, { transaction } = {}) {
    await ingrediente.restore({ transaction });
    await ingrediente.update({ deletedBy: null }, { transaction });
    return ingrediente;
  },
};

export default ingredienteActivoRepository;
