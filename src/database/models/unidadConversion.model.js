import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class UnidadConversion extends Model {}

UnidadConversion.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    unidadOrigenId: { type: DataTypes.INTEGER, allowNull: false, field: 'unidad_origen_id' },
    unidadDestinoId: { type: DataTypes.INTEGER, allowNull: false, field: 'unidad_destino_id' },
    factor: { type: DataTypes.DECIMAL(18, 6), allowNull: false },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
  },
  {
    sequelize,
    modelName: 'UnidadConversion',
    tableName: 'unidad_conversiones',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

export default UnidadConversion;
