import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class ComprobanteAspersion extends Model {}

ComprobanteAspersion.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    numero: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    aspersionProgramacionId: { type: DataTypes.INTEGER, allowNull: false, unique: true, field: 'aspersion_programacion_id' },
    estado: { type: DataTypes.ENUM('BORRADOR', 'EMITIDO'), allowNull: false, defaultValue: 'BORRADOR' },
    medio: { type: DataTypes.ENUM('AVION', 'DRON'), allowNull: true },
    piloto: { type: DataTypes.STRING(150), allowNull: true },
    hectareasProgramadas: { type: DataTypes.DECIMAL(10, 2), allowNull: false, field: 'hectareas_programadas' },
    hectareasAplicadas: { type: DataTypes.DECIMAL(10, 2), allowNull: true, field: 'hectareas_aplicadas' },
    galonesTotales: { type: DataTypes.DECIMAL(12, 2), allowNull: true, field: 'galones_totales' },
    observaciones: { type: DataTypes.TEXT, allowNull: true },
    ejecutadoPorId: { type: DataTypes.INTEGER, allowNull: true, field: 'ejecutado_por_id' },
    ejecutadoEn: { type: DataTypes.DATE, allowNull: true, field: 'ejecutado_en' },
    emitidoPorId: { type: DataTypes.INTEGER, allowNull: true, field: 'emitido_por_id' },
    emitidoEn: { type: DataTypes.DATE, allowNull: true, field: 'emitido_en' },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'ComprobanteAspersion',
    tableName: 'comprobantes_aspersion',
    underscored: true,
    paranoid: true,
  },
);

export default ComprobanteAspersion;
