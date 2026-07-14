import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class Finca extends Model {}

Finca.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    codigo: { type: DataTypes.STRING(20), allowNull: false, unique: true },
    nombre: { type: DataTypes.STRING(150), allowNull: false },
    estado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'Finca',
    tableName: 'fincas',
    underscored: true,
    paranoid: true,
  },
);

export default Finca;
