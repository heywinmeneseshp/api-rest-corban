'use strict';

// Lecturas de kilometraje / horómetro de los equipos (vehículos, drones...): las registra el conductor al encender el equipo (app móvil o web) y de
// ahí se calcula lo recorrido y cuándo toca el mantenimiento de los planes por kilómetros u horas.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tablas = (await queryInterface.showAllTables()).map((t) => (typeof t === 'string' ? t : t.tableName));
    if (!tablas.includes('lecturas_equipo')) {
      await queryInterface.createTable('lecturas_equipo', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        // Lo genera el cliente: reenviar la misma lectura (cola offline de la app) no la duplica.
        uuid: { type: Sequelize.UUID, allowNull: false, unique: true },
        equipo_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'equipos', key: 'id' }, onDelete: 'CASCADE' },
        fecha_hora: { type: Sequelize.DATE, allowNull: false },
        kilometraje: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
        horometro: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
        usuario_id: { type: Sequelize.INTEGER, allowNull: true },
        origen: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'WEB' },
        nota: { type: Sequelize.STRING(300), allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
      });
      await queryInterface.addIndex('lecturas_equipo', ['equipo_id', 'fecha_hora'], { name: 'lecturas_equipo_equipo_fecha' });
    }
    const cols = await queryInterface.describeTable('planes_mantenimiento');
    // Lectura del equipo (km u horas) en el último mantenimiento: de ahí se cuenta la periodicidad de los planes por km / horas.
    if (!cols.lectura_base) await queryInterface.addColumn('planes_mantenimiento', 'lectura_base', { type: Sequelize.DECIMAL(12, 2), allowNull: true });
    // Último estado ya avisado por correo (PROXIMO | VENCIDO): evita repetir el aviso en cada lectura.
    if (!cols.aviso_estado) await queryInterface.addColumn('planes_mantenimiento', 'aviso_estado', { type: Sequelize.STRING(10), allowNull: true });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('planes_mantenimiento', 'aviso_estado');
    await queryInterface.removeColumn('planes_mantenimiento', 'lectura_base');
    await queryInterface.dropTable('lecturas_equipo');
  },
};
