import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Punto del tracking GPS de una sesión de precalibración (ver la migración 20261224000000).
export class PrecalibracionTraza extends Model {}

PrecalibracionTraza.init(
  {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    sesionId: { type: DataTypes.INTEGER, allowNull: false, field: 'sesion_id' },
    lat: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
    lng: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
    precisionM: { type: DataTypes.DECIMAL(8, 2), allowNull: true, field: 'precision_m' },
    registradoAt: { type: DataTypes.DATE(3), allowNull: false, field: 'registrado_at' },
  },
  { sequelize, modelName: 'PrecalibracionTraza', tableName: 'precalibracion_trazas', underscored: true, updatedAt: false },
);

export default PrecalibracionTraza;
