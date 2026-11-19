'use strict';

// Comprobantes de aspersión con VARIOS recorridos (KML). Se crea la tabla y se pasa a ella el KML que ya tenía cada comprobante
// (las columnas viejas kml/kml_nombre/kml_geometria/kml_subido_en se dejan, pero ya no se usan).
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tablas = (await queryInterface.showAllTables()).map((t) => (typeof t === 'string' ? t : t.tableName));
    if (!tablas.includes('comprobante_aspersion_kmls')) {
      await queryInterface.createTable('comprobante_aspersion_kmls', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        uuid: { type: Sequelize.UUID, allowNull: false, unique: true },
        comprobante_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'comprobantes_aspersion', key: 'id' }, onDelete: 'CASCADE' },
        nombre: { type: Sequelize.STRING(200), allowNull: false },
        kml: { type: Sequelize.TEXT('long'), allowNull: false },
        geometria: { type: Sequelize.JSON, allowNull: true },
        subido_en: { type: Sequelize.DATE, allowNull: false },
        created_by: { type: Sequelize.INTEGER, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
      });
      await queryInterface.addIndex('comprobante_aspersion_kmls', ['comprobante_id']);
    }
    // Los KML que ya existían pasan a la tabla nueva (una sola vez).
    await queryInterface.sequelize.query(
      `INSERT INTO comprobante_aspersion_kmls (uuid, comprobante_id, nombre, kml, geometria, subido_en, created_by, created_at, updated_at)
       SELECT UUID(), c.id, COALESCE(c.kml_nombre, CONCAT(c.numero, '.kml')), c.kml, c.kml_geometria, COALESCE(c.kml_subido_en, c.updated_at), c.updated_by, NOW(), NOW()
         FROM comprobantes_aspersion c
        WHERE c.kml IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM comprobante_aspersion_kmls k WHERE k.comprobante_id = c.id)`,
    );
  },
  async down(queryInterface) {
    await queryInterface.dropTable('comprobante_aspersion_kmls');
  },
};
