import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class OrdenDetalle extends Model {}

OrdenDetalle.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    ordenId: { type: DataTypes.INTEGER, allowNull: false, field: 'orden_id' },
    articuloId: { type: DataTypes.INTEGER, allowNull: false, field: 'articulo_id' },
    cantidad: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    costoUnitario: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: 'costo_unitario' },
    costoTotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: 'costo_total' },
    almacenId: { type: DataTypes.INTEGER, allowNull: true, field: 'almacen_id' },
    observaciones: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    modelName: 'OrdenDetalle',
    tableName: 'orden_detalles',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

export default OrdenDetalle;
