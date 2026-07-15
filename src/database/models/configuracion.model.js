import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class Configuracion extends Model {}

Configuracion.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    clave: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    valor: { type: DataTypes.TEXT, allowNull: true },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
  },
  {
    sequelize,
    modelName: 'Configuracion',
    tableName: 'configuraciones',
    underscored: true,
  },
);

export default Configuracion;
