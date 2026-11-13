import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Plantilla reutilizable de checklist de mantenimiento (secciones e ítems). Un plan la usa y cada orden copia sus ítems.
export class ChecklistPlantilla extends Model {}

ChecklistPlantilla.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    nombre: { type: DataTypes.STRING(150), allowNull: false },
    descripcion: { type: DataTypes.TEXT, allowNull: true },
    estado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
  },
  {
    sequelize,
    modelName: 'ChecklistPlantilla',
    tableName: 'checklist_plantillas',
    underscored: true,
    paranoid: true,
    deletedAt: 'deleted_at',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

export default ChecklistPlantilla;
