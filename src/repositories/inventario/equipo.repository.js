import { Op } from 'sequelize';
import { Equipo, EquipoComponente, Articulo, Almacen, User, EquipoTipo } from '../../database/associations.js';

const LIST_INCLUDE = [
  { model: EquipoTipo, as: 'tipo', attributes: ['uuid', 'nombre'] },
  { model: Almacen, as: 'ubicacion', attributes: ['uuid', 'nombre', 'codigo'] },
  { model: Almacen, as: 'centroCosto', attributes: ['uuid', 'nombre', 'codigo'] },
  { model: User, as: 'responsable', attributes: ['uuid', 'usuario', 'nombre'] },
];

const DETAIL_INCLUDE = [
  { model: EquipoTipo, as: 'tipo', attributes: ['uuid', 'nombre'] },
  { model: Almacen, as: 'ubicacion', attributes: ['uuid', 'nombre', 'codigo'] },
  { model: Almacen, as: 'centroCosto', attributes: ['uuid', 'nombre', 'codigo'] },
  { model: User, as: 'responsable', attributes: ['uuid', 'usuario', 'nombre'] },
  { model: User, as: 'creadoPor', attributes: ['uuid', 'usuario'] },
  { model: User, as: 'actualizadoPor', attributes: ['uuid', 'usuario'] },
  {
    model: Articulo,
    as: 'repuestosCompatibles',
    attributes: ['uuid', 'nombre', 'codigo'],
    through: { attributes: ['uuid', 'notas'] },
  },
  {
    model: EquipoComponente,
    as: 'componentes',
    include: [{ model: Articulo, as: 'articulo', attributes: ['uuid', 'nombre', 'codigo'] }],
  },
];

export const equipoRepository = {
  async findAndCountAll({ limit, offset, search, tipoUuid, estado, ubicacionUuid, centroCostoUuid }) {
    const where = {};
    if (search) {
      where[Op.or] = [
        { nombre: { [Op.like]: `%${search}%` } },
        { codigo: { [Op.like]: `%${search}%` } },
        { marca: { [Op.like]: `%${search}%` } },
      ];
    }
    if (tipoUuid) {
      const t = await EquipoTipo.findOne({ where: { uuid: tipoUuid } });
      where.tipoId = t ? t.id : -1;
    }
    if (estado) where.estado = estado;
    if (ubicacionUuid) {
      const alm = await Almacen.findOne({ where: { uuid: ubicacionUuid } });
      where.ubicacionId = alm ? alm.id : -1;
    }
    if (centroCostoUuid) {
      const alm = await Almacen.findOne({ where: { uuid: centroCostoUuid } });
      where.centroCostoId = alm ? alm.id : -1;
    }
    return Equipo.findAndCountAll({
      where,
      limit,
      offset,
      order: [['nombre', 'ASC']],
      include: LIST_INCLUDE,
      distinct: true,
    });
  },

  findByUuid(uuid, { transaction } = {}) {
    return Equipo.findOne({ where: { uuid }, include: DETAIL_INCLUDE, transaction });
  },

  findByCodigo(codigo) {
    if (!codigo) return null;
    return Equipo.findOne({ where: { codigo } });
  },

  create(data, { transaction } = {}) {
    return Equipo.create(data, { transaction });
  },

  async update(equipo, data, { transaction } = {}) {
    await equipo.update(data, { transaction });
    return equipo;
  },

  async softDelete(equipo, deletedBy, { transaction } = {}) {
    await equipo.update({ deletedBy }, { transaction });
    await equipo.destroy({ transaction });
    return equipo;
  },

  async addComponente(equipoId, articuloId, notas, { transaction } = {}) {
    return EquipoComponente.create({ equipoId, articuloId, notas: notas || null }, { transaction });
  },

  async removeComponente(equipoId, articuloId, { transaction } = {}) {
    return EquipoComponente.destroy({ where: { equipoId, articuloId }, transaction });
  },

  async getComponentes(equipoId) {
    return EquipoComponente.findAll({ where: { equipoId }, include: [{ model: Articulo, as: 'articulo' }] });
  },
};

export default equipoRepository;
