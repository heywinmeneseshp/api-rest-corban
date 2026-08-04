import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class CategoriaLabor extends Model {}

CategoriaLabor.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    nombre: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    orden: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    estado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'CategoriaLabor',
    tableName: 'categorias_labor',
    underscored: true,
    paranoid: true,
  },
);

export default CategoriaLabor;
