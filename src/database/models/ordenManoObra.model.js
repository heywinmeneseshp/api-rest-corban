import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class OrdenManoObra extends Model {}

OrdenManoObra.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    ordenId: { type: DataTypes.INTEGER, allowNull: false, field: 'orden_id' },
    descripcion: { type: DataTypes.STRING(500), allowNull: false },
    horas: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 0 },
    costoHora: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: 'costo_hora' },
    costoTotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: 'costo_total' },
    responsableId: { type: DataTypes.INTEGER, allowNull: true, field: 'responsable_id' },
    observaciones: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    modelName: 'OrdenManoObra',
    tableName: 'orden_mano_obra',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

export default OrdenManoObra;
