import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Ítem del checklist de una orden de mantenimiento (copia de la plantilla) con su calificación y observación.
export class OrdenChecklistItem extends Model {}

OrdenChecklistItem.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    ordenId: { type: DataTypes.INTEGER, allowNull: false, field: 'orden_id' },
    plantillaItemId: { type: DataTypes.INTEGER, allowNull: true, field: 'plantilla_item_id' },
    seccion: { type: DataTypes.STRING(200), allowNull: false },
    seccionOrden: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'seccion_orden' },
    orden: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    descripcion: { type: DataTypes.TEXT, allowNull: false },
    // SATISFACTORIO | OBSERVACION | INSATISFACTORIO | NA | PENDIENTE
    calificacion: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'PENDIENTE' },
    observaciones: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    modelName: 'OrdenChecklistItem',
    tableName: 'orden_checklist_items',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

export default OrdenChecklistItem;
