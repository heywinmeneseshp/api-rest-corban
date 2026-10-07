import { Op } from 'sequelize';
import { LoteAreaProduccion, Semana, User } from '../../database/associations.js';

const INCLUDE_SEMANA = { model: Semana, as: 'semana', attributes: ['uuid', 'codigo', 'numeroSemana', 'anio', 'fechaInicio', 'fechaFin'], required: false };

export const loteAreaProduccionRepository = {
  // Historial de un lote: de la semana más reciente a la más antigua; dentro de
  // la semana, el último registro primero.
  findAndCountByLoteId(loteId, { limit, offset }) {
    return LoteAreaProduccion.findAndCountAll({
      where: { loteId },
      limit,
      offset,
      // Quién registró cada actualización y a qué semana pertenece.
      include: [{ model: User, as: 'creadoPor', attributes: ['uuid', 'usuario', 'nombre', 'apellido'] }, INCLUDE_SEMANA],
      order: [
        [{ model: Semana, as: 'semana' }, 'fechaInicio', 'DESC'],
        ['fechaRegistro', 'DESC'],
        ['id', 'DESC'],
      ],
    });
  },

  // Valor ACTUAL del lote: el registro de la semana más reciente (el último de
  // esa semana); una corrección retroactiva de una semana vieja no lo cambia.
  findLatestByLoteId(loteId) {
    return LoteAreaProduccion.findOne({
      where: { loteId },
      include: [INCLUDE_SEMANA],
      order: [
        [{ model: Semana, as: 'semana' }, 'fechaInicio', 'DESC'],
        ['fechaRegistro', 'DESC'],
        ['id', 'DESC'],
      ],
    });
  },

  // Área vigente en una semana: el último registro de esa semana o, si no tiene,
  // el de la última semana anterior que sí tenga (para reportes semanales).
  async areaVigenteEnSemana(loteId, semana) {
    return LoteAreaProduccion.findOne({
      where: { loteId },
      include: [{ ...INCLUDE_SEMANA, required: true, where: { fechaInicio: { [Op.lte]: semana.fechaInicio } } }],
      order: [
        [{ model: Semana, as: 'semana' }, 'fechaInicio', 'DESC'],
        ['id', 'DESC'],
      ],
    });
  },

  create(data, { transaction } = {}) {
    return LoteAreaProduccion.create(data, { transaction });
  },
};

export default loteAreaProduccionRepository;
