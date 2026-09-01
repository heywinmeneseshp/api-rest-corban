import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class Factura extends Model {}

Factura.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    numero: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    proformaId: { type: DataTypes.INTEGER, allowNull: false, unique: true, field: 'proforma_id' },
    cliente: { type: DataTypes.STRING(200), allowNull: false },
    clienteIdentificacion: { type: DataTypes.STRING(50), allowNull: true, field: 'cliente_identificacion' },
    clienteEmail: { type: DataTypes.STRING(150), allowNull: true, field: 'cliente_email' },
    fecha: { type: DataTypes.DATEONLY, allowNull: false },
    descuento: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    impuestos: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    total: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    estado: { type: DataTypes.ENUM('EMITIDA', 'ANULADA'), allowNull: false, defaultValue: 'EMITIDA' },
    observaciones: { type: DataTypes.TEXT, allowNull: true },
    usuarioId: { type: DataTypes.INTEGER, allowNull: true, field: 'usuario_id' },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
  },
  {
    sequelize,
    modelName: 'Factura',
    tableName: 'facturas',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

export default Factura;
