import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class FacturaDetalle extends Model {}

FacturaDetalle.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    facturaId: { type: DataTypes.INTEGER, allowNull: false, field: 'factura_id' },
    articuloId: { type: DataTypes.INTEGER, allowNull: false, field: 'articulo_id' },
    cantidad: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    precioUnitario: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: 'precio_unitario' },
    descuento: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    observaciones: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    modelName: 'FacturaDetalle',
    tableName: 'factura_detalles',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

export default FacturaDetalle;
