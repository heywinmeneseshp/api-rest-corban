import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Re-estimación pendiente de aprobación: la estimación vigente (`estimacionId`) no cambia hasta que se aprueba.
export class EstimacionFincaCambio extends Model {}

EstimacionFincaCambio.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    estimacionId: { type: DataTypes.INTEGER, allowNull: false, field: 'estimacion_id' },
    semanaId: { type: DataTypes.INTEGER, allowNull: false, field: 'semana_id' },
    fincaId: { type: DataTypes.INTEGER, allowNull: false, field: 'finca_id' },
    semanaRegistroId: { type: DataTypes.INTEGER, allowNull: false, field: 'semana_registro_id' },
    cajasAnterior: { type: DataTypes.DECIMAL(10, 2), allowNull: false, field: 'cajas_anterior' },
    cajasNueva: { type: DataTypes.DECIMAL(10, 2), allowNull: false, field: 'cajas_nueva' },
    observaciones: { type: DataTypes.TEXT, allowNull: true },
    estado: { type: DataTypes.ENUM('PENDIENTE', 'APROBADA', 'RECHAZADA'), allowNull: false, defaultValue: 'PENDIENTE' },
    motivoRechazo: { type: DataTypes.TEXT, allowNull: true, field: 'motivo_rechazo' },
    solicitadoBy: { type: DataTypes.INTEGER, allowNull: true, field: 'solicitado_by' },
    resueltoBy: { type: DataTypes.INTEGER, allowNull: true, field: 'resuelto_by' },
    resueltoAt: { type: DataTypes.DATE, allowNull: true, field: 'resuelto_at' },
  },
  { sequelize, modelName: 'EstimacionFincaCambio', tableName: 'estimaciones_finca_cambios', underscored: true },
);

export default EstimacionFincaCambio;
