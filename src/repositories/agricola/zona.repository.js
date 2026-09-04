import { Op } from 'sequelize';
import { Zona, Finca, ZonaFinca } from '../../database/associations.js';

export const zonaRepository = {
  async findAndCountAll({ limit, offset, search }) {
    const where = search ? { nombre: { [Op.like]: `%${search}%` } } : undefined;
    return Zona.findAndCountAll({
      where,
      limit,
      offset,
      order: [['nombre', 'ASC']],
      include: [{ model: Finca, as: 'fincas', attributes: ['id', 'uuid', 'codigo', 'nombre'], through: { attributes: [] } }],
      distinct: true,
    });
  },
  findByUuid(uuid) {
    return Zona.findOne({
      where: { uuid },
      include: [{ model: Finca, as: 'fincas', attributes: ['id', 'uuid', 'codigo', 'nombre'], through: { attributes: [] } }],
    });
  },
  findById(id) {
    return Zona.findByPk(id);
  },
  findByNombre(nombre) {
    return Zona.findOne({ where: { nombre } });
  },
  create(data, { transaction } = {}) {
    return Zona.create(data, { transaction });
  },
  async update(zona, data, { transaction } = {}) {
    await zona.update(data, { transaction });
    return zona;
  },
  async softDelete(zona, deletedBy, { transaction } = {}) {
    await zona.update({ deletedBy }, { transaction });
    await zona.destroy({ transaction });
    return zona;
  },
  assignFinca(zonaId, fincaId, createdBy, { transaction } = {}) {
    return ZonaFinca.findOrCreate({
      where: { zonaId, fincaId },
      defaults: { zonaId, fincaId, createdBy },
      transaction,
    });
  },
  removeFinca(zonaId, fincaId, { transaction } = {}) {
    return ZonaFinca.destroy({ where: { zonaId, fincaId }, transaction });
  },
};

export default zonaRepository;
