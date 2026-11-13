'use strict';

const crypto = require('node:crypto');

// Mantenimiento con checklist (a partir de los documentos del servicio de 100 h del DJI Agras T100): plantillas de checklist reutilizables, el checklist
// ejecutado en cada orden, hallazgos con acciones, partes con serie (baterías, control remoto...), participantes y adjuntos (fotos / carta) del servicio,
// y los datos del servicio externo en la orden. Se siembra la plantilla del T100.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const q = queryInterface;
    const tablas = (await q.showAllTables()).map((t) => (typeof t === 'string' ? t : t.tableName));
    const ahora = () => new Date();
    const fechas = {
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    };
    const id = { id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true } };
    const uuid = { uuid: { type: Sequelize.UUID, allowNull: false, unique: true } };
    const fk = (tabla, extra = {}) => ({ type: Sequelize.INTEGER, references: { model: tabla, key: 'id' }, ...extra });

    if (!tablas.includes('checklist_plantillas')) {
      await q.createTable('checklist_plantillas', {
        ...id,
        ...uuid,
        nombre: { type: Sequelize.STRING(150), allowNull: false },
        descripcion: { type: Sequelize.TEXT, allowNull: true },
        estado: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_by: { type: Sequelize.INTEGER, allowNull: true },
        updated_by: { type: Sequelize.INTEGER, allowNull: true },
        ...fechas,
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      });
      await q.createTable('checklist_plantilla_items', {
        ...id,
        plantilla_id: fk('checklist_plantillas', { allowNull: false, onDelete: 'CASCADE' }),
        seccion: { type: Sequelize.STRING(200), allowNull: false },
        seccion_orden: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        orden: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        descripcion: { type: Sequelize.TEXT, allowNull: false },
        ...fechas,
      });
      // Plantilla del T100 (se repite en la migración solo si la tabla es nueva).
      const { PLANTILLA_T100_NOMBRE, PLANTILLA_T100_DESCRIPCION, PLANTILLA_T100_SECCIONES } = await import('../../constants/checklistT100.js');
      await q.bulkInsert('checklist_plantillas', [{ uuid: crypto.randomUUID(), nombre: PLANTILLA_T100_NOMBRE, descripcion: PLANTILLA_T100_DESCRIPCION, estado: true, created_at: ahora(), updated_at: ahora() }]);
      const [{ id: plantillaId }] = await q.sequelize.query('SELECT id FROM checklist_plantillas WHERE nombre = :n LIMIT 1', { replacements: { n: PLANTILLA_T100_NOMBRE }, type: q.sequelize.QueryTypes.SELECT });
      const items = [];
      PLANTILLA_T100_SECCIONES.forEach((s, si) => s.items.forEach((d, ii) => items.push({ plantilla_id: plantillaId, seccion: s.seccion, seccion_orden: si + 1, orden: ii + 1, descripcion: d, created_at: ahora(), updated_at: ahora() })));
      await q.bulkInsert('checklist_plantilla_items', items);
    }

    const colsPlan = await q.describeTable('planes_mantenimiento');
    if (!colsPlan.plantilla_id) await q.addColumn('planes_mantenimiento', 'plantilla_id', fk('checklist_plantillas', { allowNull: true, onDelete: 'SET NULL' }));

    if (!tablas.includes('orden_checklist_items')) {
      await q.createTable('orden_checklist_items', {
        ...id,
        ...uuid,
        orden_id: fk('ordenes_mantenimiento', { allowNull: false, onDelete: 'CASCADE' }),
        plantilla_item_id: { type: Sequelize.INTEGER, allowNull: true },
        seccion: { type: Sequelize.STRING(200), allowNull: false },
        seccion_orden: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        orden: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        descripcion: { type: Sequelize.TEXT, allowNull: false },
        // SATISFACTORIO | OBSERVACION | INSATISFACTORIO | NA | PENDIENTE
        calificacion: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'PENDIENTE' },
        observaciones: { type: Sequelize.TEXT, allowNull: true },
        ...fechas,
      });
      await q.addIndex('orden_checklist_items', ['orden_id'], { name: 'orden_checklist_items_orden' });
    }

    if (!tablas.includes('partes_equipo')) {
      await q.createTable('partes_equipo', {
        ...id,
        ...uuid,
        equipo_id: fk('equipos', { allowNull: true, onDelete: 'SET NULL' }),
        // BATERIA | CONTROL_REMOTO | CARGADOR | ANTENA | OTRO
        tipo: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'OTRO' },
        codigo: { type: Sequelize.STRING(60), allowNull: false },
        serie: { type: Sequelize.STRING(100), allowNull: true },
        descripcion: { type: Sequelize.STRING(200), allowNull: true },
        // ACTIVA | EN_REVISION | RETIRADA
        estado: { type: Sequelize.STRING(15), allowNull: false, defaultValue: 'ACTIVA' },
        ciclos: { type: Sequelize.DECIMAL(10, 0), allowNull: false, defaultValue: 0 },
        observaciones: { type: Sequelize.TEXT, allowNull: true },
        created_by: { type: Sequelize.INTEGER, allowNull: true },
        updated_by: { type: Sequelize.INTEGER, allowNull: true },
        ...fechas,
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      });
      await q.createTable('parte_equipo_registros', {
        ...id,
        ...uuid,
        parte_id: fk('partes_equipo', { allowNull: false, onDelete: 'CASCADE' }),
        // CICLOS | NOVEDAD | MANTENIMIENTO | ASIGNACION
        tipo: { type: Sequelize.STRING(15), allowNull: false },
        fecha_hora: { type: Sequelize.DATE, allowNull: false },
        ciclos: { type: Sequelize.DECIMAL(10, 0), allowNull: true },
        descripcion: { type: Sequelize.TEXT, allowNull: true },
        equipo_id: { type: Sequelize.INTEGER, allowNull: true },
        usuario_id: { type: Sequelize.INTEGER, allowNull: true },
        ...fechas,
      });
    }

    if (!tablas.includes('orden_hallazgos')) {
      await q.createTable('orden_hallazgos', {
        ...id,
        ...uuid,
        orden_id: fk('ordenes_mantenimiento', { allowNull: false, onDelete: 'CASCADE' }),
        checklist_item_id: { type: Sequelize.INTEGER, allowNull: true },
        parte_id: { type: Sequelize.INTEGER, allowNull: true },
        descripcion: { type: Sequelize.TEXT, allowNull: false },
        calificacion: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'OBSERVACION' },
        accion_ejecutada: { type: Sequelize.TEXT, allowNull: true },
        pendiente_repuesto: { type: Sequelize.TEXT, allowNull: true },
        recomendacion: { type: Sequelize.TEXT, allowNull: true },
        prioridad: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'MEDIA' },
        // ABIERTO | EN_SEGUIMIENTO | RESUELTO
        estado: { type: Sequelize.STRING(15), allowNull: false, defaultValue: 'ABIERTO' },
        programacion_id: { type: Sequelize.INTEGER, allowNull: true },
        fecha_resolucion: { type: Sequelize.DATEONLY, allowNull: true },
        created_by: { type: Sequelize.INTEGER, allowNull: true },
        updated_by: { type: Sequelize.INTEGER, allowNull: true },
        ...fechas,
      });
      await q.addIndex('orden_hallazgos', ['orden_id'], { name: 'orden_hallazgos_orden' });
    }

    if (!tablas.includes('orden_participantes')) {
      await q.createTable('orden_participantes', {
        ...id,
        orden_id: fk('ordenes_mantenimiento', { allowNull: false, onDelete: 'CASCADE' }),
        nombre: { type: Sequelize.STRING(150), allowNull: false },
        colaborador_id: { type: Sequelize.INTEGER, allowNull: true },
        // ENTRENAMIENTO | ACOMPANANTE
        rol: { type: Sequelize.STRING(15), allowNull: false, defaultValue: 'ENTRENAMIENTO' },
        ...fechas,
      });
    }

    if (!tablas.includes('orden_adjuntos')) {
      await q.createTable('orden_adjuntos', {
        ...id,
        ...uuid,
        orden_id: fk('ordenes_mantenimiento', { allowNull: false, onDelete: 'CASCADE' }),
        hallazgo_id: { type: Sequelize.INTEGER, allowNull: true },
        checklist_item_id: { type: Sequelize.INTEGER, allowNull: true },
        // FOTO | CARTA_AUTORIZACION | INFORME
        tipo: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'FOTO' },
        id_drive: { type: Sequelize.STRING(100), allowNull: false },
        url_drive: { type: Sequelize.STRING(500), allowNull: true },
        nombre_original: { type: Sequelize.STRING(255), allowNull: true },
        mime: { type: Sequelize.STRING(100), allowNull: true },
        created_by: { type: Sequelize.INTEGER, allowNull: true },
        ...fechas,
      });
    }

    const colsOrden = await q.describeTable('ordenes_mantenimiento');
    const agregar = async (nombre, def) => {
      if (!colsOrden[nombre]) await q.addColumn('ordenes_mantenimiento', nombre, def);
    };
    await agregar('ejecutor_tipo', { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'INTERNO' });
    await agregar('proveedor_id', { type: Sequelize.INTEGER, allowNull: true });
    await agregar('tecnico_responsable', { type: Sequelize.STRING(150), allowNull: true });
    await agregar('fecha_inicio', { type: Sequelize.DATEONLY, allowNull: true });
    await agregar('lectura_km', { type: Sequelize.DECIMAL(12, 2), allowNull: true });
    await agregar('lectura_horas', { type: Sequelize.DECIMAL(12, 2), allowNull: true });
    await agregar('recibido_por', { type: Sequelize.STRING(150), allowNull: true });
    await agregar('fecha_aceptacion', { type: Sequelize.DATEONLY, allowNull: true });

    const colsEquipo = await q.describeTable('equipos');
    // Configuración instalada (p. ej. «LS100, Esparcido 4.0») para la identificación del equipo en el informe.
    if (!colsEquipo.configuracion) await q.addColumn('equipos', 'configuracion', { type: Sequelize.STRING(300), allowNull: true });
  },

  async down(queryInterface) {
    const q = queryInterface;
    await q.removeColumn('equipos', 'configuracion');
    for (const c of ['fecha_aceptacion', 'recibido_por', 'lectura_horas', 'lectura_km', 'fecha_inicio', 'tecnico_responsable', 'proveedor_id', 'ejecutor_tipo']) await q.removeColumn('ordenes_mantenimiento', c);
    await q.dropTable('orden_adjuntos');
    await q.dropTable('orden_participantes');
    await q.dropTable('orden_hallazgos');
    await q.dropTable('parte_equipo_registros');
    await q.dropTable('partes_equipo');
    await q.dropTable('orden_checklist_items');
    await q.removeColumn('planes_mantenimiento', 'plantilla_id');
    await q.dropTable('checklist_plantilla_items');
    await q.dropTable('checklist_plantillas');
  },
};
