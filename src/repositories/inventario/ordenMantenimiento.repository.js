import { Op } from 'sequelize';
import {
  OrdenMantenimiento,
  Equipo,
  EquipoTipo,
  PlanMantenimiento,
  ProgramacionMantenimiento,
  OrdenDetalle,
  OrdenManoObra,
  OrdenServicio,
  Articulo,
  Almacen,
  User,
} from '../../database/associations.js';

const INCLUDE = [
  // `tipo` NO es un atributo propio de Equipo (es una relación a
  // EquipoTipo vía `tipoId`, ver equipo.model.js) — pedirlo como atributo
  // plano rompía CUALQUIER lectura de una orden con "Unknown column
  // 'equipo.tipo'". Se corrige anidando la relación real.
  {
    model: Equipo,
    as: 'equipo',
    attributes: ['uuid', 'codigo', 'nombre', 'estado'],
    include: [{ model: EquipoTipo, as: 'tipo', attributes: ['uuid', 'nombre'] }],
  },
  { model: PlanMantenimiento, as: 'plan', attributes: ['uuid', 'nombre', 'tipo'] },
  { model: ProgramacionMantenimiento, as: 'programacion', attributes: ['uuid', 'fechaProgramada', 'estado'] },
  { model: Almacen, as: 'almacen', attributes: ['uuid', 'nombre', 'codigo'] },
  { model: User, as: 'responsable', attributes: ['uuid', 'usuario', 'nombre'] },
  { model: User, as: 'usuario', attributes: ['uuid', 'usuario', 'nombre'] },
  {
    model: OrdenDetalle,
    as: 'detalles',
    include: [
      { model: Articulo, as: 'articulo', attributes: ['uuid', 'nombre', 'codigo'] },
      { model: Almacen, as: 'almacen', attributes: ['uuid', 'nombre'] },
    ],
  },
  {
    model: OrdenManoObra,
    as: 'manoObra',
    include: [{ model: User, as: 'responsable', attributes: ['uuid', 'usuario', 'nombre'] }],
  },
  { model: OrdenServicio, as: 'servicios' },
];

export const ordenMantenimientoRepository = {
  async findAndCountAll({ limit, offset, equipoUuid, planUuid, estado, prioridad, tipo, fechaDesde, fechaHasta, search, almacenIdsPermitidos }) {
    const where = {};
    if (estado) where.estado = estado;
    if (prioridad) where.prioridad = prioridad;
    if (tipo) where.tipo = tipo;
    if (search) {
      where[Op.or] = [{ numero: { [Op.like]: `%${search}%` } }, { descripcion: { [Op.like]: `%${search}%` } }];
    }
    // `almacenId` es nullable (una orden puede ser solo de mano de obra/
    // servicio, sin repuestos) — una orden sin almacén queda visible para
    // todos, igual criterio "abierto por defecto" que el resto del scope.
    // Se combina con `Op.and` para no pisar el `Op.or` de `search` de arriba.
    if (almacenIdsPermitidos !== null && almacenIdsPermitidos !== undefined) {
      where[Op.and] = [
        ...(where[Op.and] || []),
        { [Op.or]: [{ almacenId: null }, { almacenId: { [Op.in]: almacenIdsPermitidos } }] },
      ];
    }
    if (fechaDesde || fechaHasta) {
      where.fecha = {};
      if (fechaDesde) where.fecha[Op.gte] = fechaDesde;
      if (fechaHasta) where.fecha[Op.lte] = fechaHasta;
    }
    if (equipoUuid) {
      const eq = await Equipo.findOne({ where: { uuid: equipoUuid } });
      where.equipoId = eq ? eq.id : -1;
    }
    if (planUuid) {
      const pl = await PlanMantenimiento.findOne({ where: { uuid: planUuid } });
      where.planId = pl ? pl.id : -1;
    }
    return OrdenMantenimiento.findAndCountAll({
      where,
      limit,
      offset,
      order: [['fecha', 'DESC'], ['id', 'DESC']],
      include: INCLUDE,
      distinct: true,
    });
  },

  findByUuid(uuid) {
    return OrdenMantenimiento.findOne({ where: { uuid }, include: INCLUDE });
  },

  findByNumero(numero) {
    return OrdenMantenimiento.findOne({ where: { numero } });
  },

  create(data, { transaction } = {}) {
    return OrdenMantenimiento.create(data, { transaction });
  },

  async update(orden, data, { transaction } = {}) {
    await orden.update(data, { transaction });
    return orden;
  },

  async softDelete(orden, deletedBy, { transaction } = {}) {
    await orden.update({ deletedBy }, { transaction });
    await orden.destroy({ transaction });
    return orden;
  },
};

export default ordenMantenimientoRepository;
