'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('estadios_sigatoka', 'valor_l3', {
      type: Sequelize.DECIMAL(8, 2),
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn('estadios_sigatoka', 'valor_l4', {
      type: Sequelize.DECIMAL(8, 2),
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn('estadios_sigatoka', 'valor_l5', {
      type: Sequelize.DECIMAL(8, 2),
      allowNull: false,
      defaultValue: 0,
    });

    // El valor único que existía hasta ahora correspondía a la hoja 3. Hoja 4
    // y 5 arrancan con la misma relación aritmética que traía la tabla de
    // referencia usada para armar esta migración (L4 = L3 - 20, L5 = L3 - 40),
    // excepto el estadio "0" (sin estadio) que se mantiene en 0 para las
    // tres. Es solo un punto de partida: se puede ajustar libremente desde
    // Maestros → Estadios de Sigatoka.
    await queryInterface.sequelize.query('UPDATE estadios_sigatoka SET valor_l3 = valor');
    await queryInterface.sequelize.query(
      "UPDATE estadios_sigatoka SET valor_l4 = CASE WHEN estadio = '0' THEN 0 ELSE valor - 20 END",
    );
    await queryInterface.sequelize.query(
      "UPDATE estadios_sigatoka SET valor_l5 = CASE WHEN estadio = '0' THEN 0 ELSE valor - 40 END",
    );

    await queryInterface.removeColumn('estadios_sigatoka', 'valor');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('estadios_sigatoka', 'valor', {
      type: Sequelize.DECIMAL(8, 2),
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.sequelize.query('UPDATE estadios_sigatoka SET valor = valor_l3');

    await queryInterface.removeColumn('estadios_sigatoka', 'valor_l3');
    await queryInterface.removeColumn('estadios_sigatoka', 'valor_l4');
    await queryInterface.removeColumn('estadios_sigatoka', 'valor_l5');
  },
};
