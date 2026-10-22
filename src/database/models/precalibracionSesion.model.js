import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Sesión de precalibración de un usuario en un lote (ver la migración 20261223000000).
export class PrecalibracionSesion extends Model {}

PrecalibracionSesion.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    fincaId: { type: DataTypes.INTEGER, allowNull: false, field: 'finca_id' },
    loteId: { type: DataTypes.INTEGER, allowNull: false, field: 'lote_id' },
    semanaId: { type: DataTypes.INTEGER, allowNull: false, field: 'semana_id' },
    tipo: { type: DataTypes.ENUM('VIGENTE', 'ANTICIPADA'), allowNull: false, defaultValue: 'VIGENTE' },
    inicioAt: { type: DataTypes.DATE, allowNull: false, field: 'inicio_at' },
    finAt: { type: DataTypes.DATE, allowNull: true, field: 'fin_at' },
    potencialRacimos: { type: DataTypes.INTEGER, allowNull: true, field: 'potencial_racimos' },
    potencialCajas: { type: DataTypes.INTEGER, allowNull: true, field: 'potencial_cajas' },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'PrecalibracionSesion',
    tableName: 'precalibracion_sesiones',
    underscored: true,
    paranoid: true,
  },
);

export default PrecalibracionSesion;
