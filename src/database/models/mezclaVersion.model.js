import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class MezclaVersion extends Model {}

MezclaVersion.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    mezclaId: { type: DataTypes.INTEGER, allowNull: false, field: 'mezcla_id' },
    version: { type: DataTypes.INTEGER, allowNull: false },
    activa: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    costoTotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: 'costo_total' },
    costoUnitario: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: 'costo_unitario' },
    creadaPor: { type: DataTypes.INTEGER, allowNull: true, field: 'creada_por' },
  },
  {
    sequelize,
    modelName: 'MezclaVersion',
    tableName: 'mezcla_versiones',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

export default MezclaVersion;
