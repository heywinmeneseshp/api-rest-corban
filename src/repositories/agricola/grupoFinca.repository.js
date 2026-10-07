import { Op } from 'sequelize';
import { GrupoFinca, Finca } from '../../database/associations.js';

export const grupoFincaRepository = {
  async findAndCountAll({ limit, offset, search, incluirEliminados = false }) {
    const where = search ? { nombre: { [Op.like]: `%${search}%` } } : undefined;
    // incluirEliminados: trae también los grupos eliminados (para poder restaurarlos).
    return GrupoFinca.findAndCountAll({ where, limit, offset, order: [['nombre', 'ASC']], paranoid: !incluirEliminados });
  },
  // Cantidad de fincas (no eliminadas) vinculadas a cada grupo.
  async contarFincasPorGrupo(grupoIds) {
    if (grupoIds.length === 0) return new Map();
    const rows = await Finca.findAll({
      where: { grupoFincaId: { [Op.in]: grupoIds } },
      attributes: ['grupoFincaId', [Finca.sequelize.fn('COUNT', Finca.sequelize.col('id')), 'total']],
      group: ['grupoFincaId'],
      raw: true,
    });
    return new Map(rows.map((r) => [r.grupoFincaId, Number(r.total)]));
  },
  findByUuidIncluyendoEliminados(uuid) {
    return GrupoFinca.findOne({ where: { uuid }, paranoid: false });
  },
  async restore(grupo, { transaction } = {}) {
    await grupo.restore({ transaction });
    await grupo.update({ deletedBy: null }, { transaction });
    return grupo;
  },
  findByUuid(uuid) {
    return GrupoFinca.findOne({ where: { uuid }, include: [{ model: Finca, as: 'fincas' }] });
  },
  findById(id) {
    return GrupoFinca.findByPk(id);
  },
  findByNombre(nombre) {
    return GrupoFinca.findOne({ where: { nombre } });
  },
  findAll() {
    return GrupoFinca.findAll({ order: [['nombre', 'ASC']] });
  },
  create(data, { transaction } = {}) {
    return GrupoFinca.create(data, { transaction });
  },
  async update(grupo, data, { transaction } = {}) {
    await grupo.update(data, { transaction });
    return grupo;
  },
  async softDelete(grupo, deletedBy, { transaction } = {}) {
    await grupo.update({ deletedBy }, { transaction });
    await grupo.destroy({ transaction });
    return grupo;
  },
};

export default grupoFincaRepository;
