import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class Proforma extends Model {}

Proforma.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    numero: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    cliente: { type: DataTypes.STRING(200), allowNull: false },
    clienteIdentificacion: { type: DataTypes.STRING(50), allowNull: true, field: 'cliente_identificacion' },
    clienteEmail: { type: DataTypes.STRING(150), allowNull: true, field: 'cliente_email' },
    fecha: { type: DataTypes.DATEONLY, allowNull: false },
    fechaVigencia: { type: DataTypes.DATEONLY, allowNull: true, field: 'fecha_vigencia' },
    descuento: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    impuestos: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    total: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    estado: {
      type: DataTypes.ENUM('BORRADOR', 'APROBADA', 'ENVIADA', 'CONVERTIDA', 'VENCIDA', 'CANCELADA'),
      allowNull: false,
      defaultValue: 'BORRADOR',
    },
    observaciones: { type: DataTypes.TEXT, allowNull: true },
    usuarioId: { type: DataTypes.INTEGER, allowNull: true, field: 'usuario_id' },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'Proforma',
    tableName: 'proformas',
    underscored: true,
    paranoid: true,
  },
);

export default Proforma;
