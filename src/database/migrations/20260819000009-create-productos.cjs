'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('productos', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true, defaultValue: Sequelize.UUIDV4 },
      // Código del combo en Logística (consecutivo), cuando aplica — no
      // obligatorio porque también se puede crear un producto a mano.
      codigo: { type: Sequelize.STRING(20), allowNull: true },
      nombre: { type: Sequelize.STRING(150), allowNull: false, unique: true },
      pesoNeto: { type: Sequelize.FLOAT, allowNull: true, field: 'peso_neto' },
      pesoBruto: { type: Sequelize.FLOAT, allowNull: true, field: 'peso_bruto' },
      cajasPorPalet: { type: Sequelize.INTEGER, allowNull: true, field: 'cajas_por_palet' },
      cajasPorMinipalet: { type: Sequelize.INTEGER, allowNull: true, field: 'cajas_por_minipalet' },
      cantidadPalets: { type: Sequelize.INTEGER, allowNull: true, field: 'cantidad_palets' },
      cantidadMinipalets: { type: Sequelize.INTEGER, allowNull: true, field: 'cantidad_minipalets' },
      estado: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      updated_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      deleted_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });

    // Producto en Programación de Corte: antes el UNIQUE era (fecha,
    // finca_id) — asumía un solo total de cajas por finca y día — pero un
    // mismo día una finca puede cortar varios productos, así que pasa a
    // (fecha, finca_id, producto_id).
    await queryInterface.addColumn('programacion_corte', 'producto_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'productos', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });

    const [constraints] = await queryInterface.sequelize.query(
      "SHOW INDEX FROM programacion_corte WHERE Key_name = 'uq_fecha_finca_programacion_corte'",
    );
    if (constraints.length > 0) {
      await queryInterface.removeConstraint('programacion_corte', 'uq_fecha_finca_programacion_corte');
    }

    await queryInterface.addConstraint('programacion_corte', {
      fields: ['fecha', 'finca_id', 'producto_id'],
      type: 'unique',
      name: 'uq_fecha_finca_producto_programacion_corte',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('programacion_corte', 'uq_fecha_finca_producto_programacion_corte');

    await queryInterface.addConstraint('programacion_corte', {
      fields: ['fecha', 'finca_id'],
      type: 'unique',
      name: 'uq_fecha_finca_programacion_corte',
    });

    await queryInterface.removeColumn('programacion_corte', 'producto_id');
    await queryInterface.dropTable('productos');
  },
};
