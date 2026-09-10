import { Op } from 'sequelize';
import { Comunicado, User } from '../../database/associations.js';

const INCLUDE = [{ model: User, as: 'creadoPor', attributes: ['uuid', 'usuario', 'nombre', 'apellido'] }];

export const comunicadoRepository = {
  async findAndCountAll({ limit, offset, search }) {
    const where = search ? { asunto: { [Op.like]: `%${search}%` } } : {};
    return Comunicado.findAndCountAll({
      where,
      limit,
      offset,
      order: [['created_at', 'DESC']],
      include: INCLUDE,
    });
  },

  findByUuid(uuid) {
    return Comunicado.findOne({ where: { uuid }, include: INCLUDE });
  },

  create(data, { transaction } = {}) {
    return Comunicado.create(data, { transaction });
  },
};

export default comunicadoRepository;
