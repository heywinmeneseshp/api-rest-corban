import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class LoteAreaSolicitud extends Model {}

LoteAreaSolicitud.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    loteId: { type: DataTypes.INTEGER, allowNull: false, field: 'lote_id' },
    fincaId: { type: DataTypes.INTEGER, allowNull: false, field: 'finca_id' },
    areaTotal: { type: DataTypes.DECIMAL(10, 2), allowNull: false, field: 'area_total' },
    areaProduccion: { type: DataTypes.DECIMAL(10, 2), allowNull: false, field: 'area_produccion' },
    fechaSolicitud: { type: DataTypes.DATEONLY, allowNull: false, field: 'fecha_solicitud' },
    estado: { type: DataTypes.ENUM('PENDIENTE', 'APROBADA', 'RECHAZADA'), allowNull: false, defaultValue: 'PENDIENTE' },
    solicitadoPor: { type: DataTypes.INTEGER, allowNull: true, field: 'solicitado_por' },
    resueltoPor: { type: DataTypes.INTEGER, allowNull: true, field: 'resuelto_por' },
    resueltoAt: { type: DataTypes.DATE, allowNull: true, field: 'resuelto_at' },
    motivoRechazo: { type: DataTypes.STRING(300), allowNull: true, field: 'motivo_rechazo' },
  },
  { sequelize, modelName: 'LoteAreaSolicitud', tableName: 'lote_area_solicitudes', underscored: true, paranoid: false },
);

export default LoteAreaSolicitud;
