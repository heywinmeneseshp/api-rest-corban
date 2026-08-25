import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class ProformaDetalle extends Model {}

ProformaDetalle.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    proformaId: { type: DataTypes.INTEGER, allowNull: false, field: 'proforma_id' },
    productoId: { type: DataTypes.INTEGER, allowNull: false, field: 'producto_id' },
    cantidad: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    precioUnitario: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: 'precio_unitario' },
    descuento: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    observaciones: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    modelName: 'ProformaDetalle',
    tableName: 'proforma_detalles',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

export default ProformaDetalle;
