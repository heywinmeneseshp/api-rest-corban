import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class OrdenServicio extends Model {}

OrdenServicio.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    ordenId: { type: DataTypes.INTEGER, allowNull: false, field: 'orden_id' },
    descripcion: { type: DataTypes.STRING(500), allowNull: false },
    proveedor: { type: DataTypes.STRING(150), allowNull: true },
    costo: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    observaciones: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    modelName: 'OrdenServicio',
    tableName: 'orden_servicios',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

export default OrdenServicio;
