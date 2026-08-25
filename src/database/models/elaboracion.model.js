import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class Elaboracion extends Model {}

Elaboracion.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    documento: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    mezclaVersionId: { type: DataTypes.INTEGER, allowNull: false, field: 'mezcla_version_id' },
    cantidadElaborada: { type: DataTypes.DECIMAL(12, 2), allowNull: false, field: 'cantidad_elaborada' },
    almacenId: { type: DataTypes.INTEGER, allowNull: false, field: 'almacen_id' },
    fecha: { type: DataTypes.DATEONLY, allowNull: false },
    costoTotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: 'costo_total' },
    costoUnitario: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: 'costo_unitario' },
    usuarioId: { type: DataTypes.INTEGER, allowNull: true, field: 'usuario_id' },
    observaciones: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    modelName: 'Elaboracion',
    tableName: 'elaboraciones',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

export default Elaboracion;
