import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Ítem de una plantilla de checklist, dentro de una sección.
export class ChecklistPlantillaItem extends Model {}

ChecklistPlantillaItem.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    plantillaId: { type: DataTypes.INTEGER, allowNull: false, field: 'plantilla_id' },
    seccion: { type: DataTypes.STRING(200), allowNull: false },
    seccionOrden: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'seccion_orden' },
    orden: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    descripcion: { type: DataTypes.TEXT, allowNull: false },
  },
  {
    sequelize,
    modelName: 'ChecklistPlantillaItem',
    tableName: 'checklist_plantilla_items',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

export default ChecklistPlantillaItem;
