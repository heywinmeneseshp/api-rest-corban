import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class ArticuloCategoria extends Model {}

ArticuloCategoria.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    nombre: { type: DataTypes.STRING(150), allowNull: false, unique: true },
    descripcion: { type: DataTypes.TEXT, allowNull: true },
    tipo: { type: DataTypes.ENUM('INSUMO', 'REPUESTO', 'ELABORADO', 'GENERAL'), allowNull: false, defaultValue: 'GENERAL' },
    estado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'ArticuloCategoria',
    tableName: 'articulo_categorias',
    underscored: true,
    paranoid: true,
  },
);

export default ArticuloCategoria;
