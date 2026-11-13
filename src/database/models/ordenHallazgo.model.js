import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Hallazgo de un mantenimiento: lo encontrado, la acción ejecutada, el repuesto pendiente y la recomendación. Sigue vivo después de cerrar la orden.
export class OrdenHallazgo extends Model {}

OrdenHallazgo.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    ordenId: { type: DataTypes.INTEGER, allowNull: false, field: 'orden_id' },
    checklistItemId: { type: DataTypes.INTEGER, allowNull: true, field: 'checklist_item_id' },
    parteId: { type: DataTypes.INTEGER, allowNull: true, field: 'parte_id' },
    descripcion: { type: DataTypes.TEXT, allowNull: false },
    // OBSERVACION | INSATISFACTORIO
    calificacion: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'OBSERVACION' },
    accionEjecutada: { type: DataTypes.TEXT, allowNull: true, field: 'accion_ejecutada' },
    pendienteRepuesto: { type: DataTypes.TEXT, allowNull: true, field: 'pendiente_repuesto' },
    recomendacion: { type: DataTypes.TEXT, allowNull: true },
    prioridad: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'MEDIA' },
    // ABIERTO | EN_SEGUIMIENTO | RESUELTO
    estado: { type: DataTypes.STRING(15), allowNull: false, defaultValue: 'ABIERTO' },
    programacionId: { type: DataTypes.INTEGER, allowNull: true, field: 'programacion_id' },
    fechaResolucion: { type: DataTypes.DATEONLY, allowNull: true, field: 'fecha_resolucion' },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
  },
  {
    sequelize,
    modelName: 'OrdenHallazgo',
    tableName: 'orden_hallazgos',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

export default OrdenHallazgo;
