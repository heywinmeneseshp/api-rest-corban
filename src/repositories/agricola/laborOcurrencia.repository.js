import { Op } from 'sequelize';
import { LaborOcurrencia, Labor, CategoriaLabor, Lote, User, LaborSerie, Finca } from '../../database/associations.js';

// `serie` se incluye para que el frontend sepa si la ocurrencia pertenece a
// una programación recurrente (y en qué modo_lotes) antes de decidir si
// ofrece "esta / esta y las siguientes / toda la serie".
const INCLUDE_COMPLETO = [
  { model: Labor, as: 'labor', include: [{ model: CategoriaLabor, as: 'categoria' }] },
  { model: Lote, as: 'lote', include: [{ model: Finca, as: 'finca' }] },
  { model: Finca, as: 'finca' },
  { model: User, as: 'responsable' },
  { model: LaborSerie, as: 'serie' },
];

export const laborOcurrenciaRepository = {
  bulkCreate(rows, { transaction } = {}) {
    return LaborOcurrencia.bulkCreate(rows, { transaction });
  },

  // `fincaIds`: arreglo (uno o varios, si la finca pertenece a un Grupo de
  // Finca — ver utils/fincaScope.js).
  findByFincaAndAnio(fincaIds, anio) {
    return LaborOcurrencia.findAll({
      where: {
        fincaId: { [Op.in]: fincaIds },
        fecha: { [Op.between]: [`${anio}-01-01`, `${anio}-12-31`] },
      },
      order: [['fecha', 'ASC']],
      include: INCLUDE_COMPLETO,
    });
  },

  findByUuid(uuid) {
    return LaborOcurrencia.findOne({ where: { uuid }, include: INCLUDE_COMPLETO });
  },

  async update(ocurrencia, data, { transaction } = {}) {
    await ocurrencia.update(data, { transaction });
    return ocurrencia;
  },

  async softDelete(ocurrencia, deletedBy, { transaction } = {}) {
    await ocurrencia.update({ deletedBy }, { transaction });
    await ocurrencia.destroy({ transaction });
    return ocurrencia;
  },

  // Cascada al eliminar la serie completa: solo se borran las ocurrencias
  // que todavía no se ejecutaron (COMPLETADA se conserva como histórico).
  async softDeleteProgramadasPorSerie(serieId, deletedBy, { transaction } = {}) {
    await LaborOcurrencia.update(
      { deletedBy },
      { where: { serieId, estado: 'PROGRAMADA' }, transaction },
    );
    await LaborOcurrencia.destroy({ where: { serieId, estado: 'PROGRAMADA' }, transaction });
  },

  // "Esta y las siguientes": igual que la anterior pero acotado a partir de
  // una fecha — usado tanto para eliminar como para el primer paso de editar
  // "esta y las siguientes" (limpiar el futuro de la serie original antes de
  // crear la serie continuación).
  async softDeleteProgramadasDesdeFecha(serieId, fechaDesde, deletedBy, { transaction } = {}) {
    const where = { serieId, estado: 'PROGRAMADA', fecha: { [Op.gte]: fechaDesde } };
    await LaborOcurrencia.update({ deletedBy }, { where, transaction });
    await LaborOcurrencia.destroy({ where, transaction });
  },

  // "Toda la serie": aplica los mismos valores nuevos a todas las
  // ocurrencias que todavía no se ejecutaron (COMPLETADA/CANCELADA no se
  // tocan). `data` debe traer solo los campos que realmente cambiaron.
  updateProgramadasPorSerie(serieId, data, { transaction } = {}) {
    return LaborOcurrencia.update(data, { where: { serieId, estado: 'PROGRAMADA' }, transaction });
  },
};

export default laborOcurrenciaRepository;
