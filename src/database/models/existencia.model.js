import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class Existencia extends Model {}

Existencia.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    almacenId: { type: DataTypes.INTEGER, allowNull: false, field: 'almacen_id' },
    productoId: { type: DataTypes.INTEGER, allowNull: false, field: 'producto_id' },
    saldo: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  },
  {
    sequelize,
    modelName: 'Existencia',
    tableName: 'existencias',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

export default Existencia;
