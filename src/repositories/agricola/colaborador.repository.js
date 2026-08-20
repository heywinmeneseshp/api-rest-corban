import { Op } from 'sequelize';
import { Colaborador, ColaboradorLabor, Finca, Labor } from '../../database/associations.js';

const includeLabores = [
  { model: ColaboradorLabor, as: 'labores', include: [{ model: Labor, as: 'labor', attributes: ['id', 'uuid', 'nombre', 'color'] }] },
  { model: Finca, as: 'finca', attributes: ['id', 'uuid', 'nombre'] },
];

export const colaboradorRepository = {
  async findAndCountAll({ limit, offset, search, fincaId, estado }) {
    const where = {};
    if (search) where.nombre = { [Op.like]: `%${search}%` };
    if (fincaId) where.fincaId = fincaId;
    if (estado !== undefined) where.estado = estado;

    return Colaborador.findAndCountAll({
      where,
      limit,
      offset,
      include: includeLabores,
      order: [['nombre', 'ASC']],
      distinct: true,
    });
  },

  findByUuid(uuid, { transaction } = {}) {
    return Colaborador.findOne({ where: { uuid }, include: includeLabores, transaction });
  },

  findById(id) {
    return Colaborador.findByPk(id);
  },

  create(data, { transaction } = {}) {
    return Colaborador.create(data, { transaction });
  },

  async update(colaborador, data, { transaction } = {}) {
    await colaborador.update(data, { transaction });
    return colaborador;
  },

  async softDelete(colaborador, deletedBy, { transaction } = {}) {
    await colaborador.update({ deletedBy }, { transaction });
    await colaborador.destroy({ transaction });
    return colaborador;
  },

  async replaceLabores(colaboradorId, labores, actorId, { transaction } = {}) {
    await ColaboradorLabor.destroy({ where: { colaboradorId }, transaction });
    if (labores?.length) {
      await ColaboradorLabor.bulkCreate(
        labores.map((l) => ({ colaboradorId, laborId: l.laborId, calificacion: l.calificacion, createdBy: actorId })),
        { transaction },
      );
    }
  },

  // Colaboradores calificados en una Labor puntual, mejor calificación
  // primero — para sugerir responsables al programarla.
  findPorLabor(laborId) {
    return Colaborador.findAll({
      where: { estado: true },
      include: [
        {
          model: ColaboradorLabor,
          as: 'labores',
          where: { laborId },
          attributes: ['calificacion'],
        },
      ],
      order: [[{ model: ColaboradorLabor, as: 'labores' }, 'calificacion', 'DESC']],
    });
  },
};

export default colaboradorRepository;
