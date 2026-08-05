import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class EstadioSigatoka extends Model {}

EstadioSigatoka.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    estadio: { type: DataTypes.STRING(10), allowNull: false, unique: true },
    valor: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 0 },
    orden: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    estado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'EstadioSigatoka',
    tableName: 'estadios_sigatoka',
    underscored: true,
    paranoid: true,
  },
);

export default EstadioSigatoka;
