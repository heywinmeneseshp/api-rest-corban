'use strict';

// La fecha de la parte restante llegaba como Date y se guardaba con el año 2001, por eso no salía en su semana ni en el listado.
// Se corrige el año con el de su creación, se le asigna la semana y se renumeran las partes del ciclo por fecha.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const q = (sql, replacements) => queryInterface.sequelize.query(sql, { replacements, type: 'SELECT' });
    const filas = await q("SELECT id, fecha, ciclo_uuid, YEAR(created_at) AS anio FROM aspersion_programaciones WHERE fecha < '2020-01-01' AND observaciones LIKE 'Parte restante de %'");
    for (const f of filas) {
      const fecha = `${f.anio}-${String(f.fecha).slice(5, 10)}`;
      const [semana] = await q('SELECT id FROM semanas WHERE :fecha BETWEEN fecha_inicio AND fecha_fin LIMIT 1', { fecha });
      await queryInterface.sequelize.query('UPDATE aspersion_programaciones SET fecha = :fecha, semana_id = :semana WHERE id = :id', {
        replacements: { fecha, semana: semana?.id ?? null, id: f.id },
      });
    }
    for (const ciclo of [...new Set(filas.map((f) => f.ciclo_uuid).filter(Boolean))]) {
      const partes = await q('SELECT id FROM aspersion_programaciones WHERE ciclo_uuid = :ciclo ORDER BY fecha, id', { ciclo });
      for (let i = 0; i < partes.length; i += 1) {
        await queryInterface.sequelize.query('UPDATE aspersion_programaciones SET ciclo_parte = :n WHERE id = :id', { replacements: { n: i + 1, id: partes[i].id } });
      }
    }
  },

  async down() {},
};
