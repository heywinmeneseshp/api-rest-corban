'use strict';

// Renombra las columnas de dosificación del artículo — pedido explícito:
// "dosisMaximaPorHectarea" pasa a ser "dosisPorHectarea" y
// "dosisMaximaUnidadUuid" pasa a ser "dosisUnidadUuid" (ver
// articulo.model.js). Solo renombra columnas existentes, no toca datos.

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.renameColumn('articulos', 'dosis_maxima_por_hectarea', 'dosis_por_hectarea');
    await queryInterface.renameColumn('articulos', 'dosis_maxima_unidad_id', 'dosis_unidad_id');
  },

  async down(queryInterface) {
    await queryInterface.renameColumn('articulos', 'dosis_por_hectarea', 'dosis_maxima_por_hectarea');
    await queryInterface.renameColumn('articulos', 'dosis_unidad_id', 'dosis_maxima_unidad_id');
  },
};
