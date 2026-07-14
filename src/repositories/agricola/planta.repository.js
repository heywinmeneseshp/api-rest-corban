import { Op } from 'sequelize';
import { Planta, Lote, CategoriaPlanta, Evaluacion } from '../../database/associations.js';

export const plantaRepository = {
  async findAndCountAll({ limit, offset, search, loteId }) {
    const where = {
      ...(loteId ? { loteId } : {}),
      ...(search ? { codigo: { [Op.like]: `%${search}%` } } : {}),
    };

    return Planta.findAndCountAll({
      where,
      limit,
      offset,
      order: [['id', 'ASC']],
      include: [
        { model: Lote, as: 'lote', attributes: ['id', 'uuid', 'codigo', 'nombre'] },
        { model: CategoriaPlanta, as: 'categoriaPlanta', attributes: ['id', 'uuid', 'nombre'] },
      ],
    });
  },

  findByUuid(uuid) {
    return Planta.findOne({
      where: { uuid },
      include: [
        { model: Lote, as: 'lote', attributes: ['id', 'uuid', 'codigo', 'nombre'] },
        { model: CategoriaPlanta, as: 'categoriaPlanta', attributes: ['id', 'uuid', 'nombre'] },
      ],
    });
  },

  findById(id) {
    return Planta.findByPk(id);
  },

  findByLoteAndCodigo(loteId, codigo) {
    return Planta.findOne({ where: { loteId, codigo } });
  },

  create(data, { transaction } = {}) {
    return Planta.create(data, { transaction });
  },

  async update(planta, data, { transaction } = {}) {
    await planta.update(data, { transaction });
    return planta;
  },

  async softDelete(planta, deletedBy, { transaction } = {}) {
    await planta.update({ deletedBy }, { transaction });
    await planta.destroy({ transaction });
    return planta;
  },

  findEvaluacionesByPlantaId(plantaId, { limit, offset } = {}) {
    return Evaluacion.findAndCountAll({
      where: { plantaId },
      limit,
      offset,
      order: [['fecha', 'DESC']],
    });
  },
};

export default plantaRepository;
