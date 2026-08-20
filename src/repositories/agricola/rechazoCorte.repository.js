import { QueryTypes } from 'sequelize';
import { RechazoCorte, Finca, Semana, Producto } from '../../database/associations.js';
import { sequelize } from '../../database/connection.js';

const listIncludes = [
  { model: Finca, as: 'finca', attributes: ['id', 'uuid', 'codigo', 'nombre'] },
  { model: Semana, as: 'semana', attributes: ['id', 'uuid', 'codigo', 'anio', 'numeroSemana'] },
  { model: Producto, as: 'producto', attributes: ['id', 'uuid', 'codigo', 'nombre'] },
];

export const rechazoCorteRepository = {
  bulkCreate(dataArray, { transaction } = {}) {
    return RechazoCorte.bulkCreate(dataArray, { transaction });
  },

  // Reemplazo total de una semana, mismo criterio que
  // programacionCorteRepository.deleteBySemana — el espejo no lleva
  // auditoría propia, así que es un borrado físico simple.
  deleteBySemana(semanaId, { transaction } = {}) {
    return RechazoCorte.destroy({ where: { semanaId }, transaction });
  },

  findAllBySemana(semanaId) {
    return RechazoCorte.findAll({ where: { semanaId }, include: listIncludes, order: [['fechaRechazo', 'DESC']] });
  },

  // Total de cajas rechazadas agrupado por finca, para mostrar junto al
  // resumen de Programación de Corte de esa semana.
  async sumarCajasPorFincaYSemana(semanaId) {
    return sequelize.query(
      `SELECT finca_id AS fincaId, SUM(cajas) AS totalCajas
       FROM rechazos_corte
       WHERE semana_id = :semanaId
       GROUP BY finca_id`,
      { replacements: { semanaId }, type: QueryTypes.SELECT },
    );
  },
};

export default rechazoCorteRepository;
