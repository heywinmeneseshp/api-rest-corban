import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export const TIPOS_NOVEDAD = [
  'VACACIONES',
  'COMPENSATORIO_GANADO',
  'COMPENSATORIO_TOMADO',
  'INCAPACIDAD',
  'PERMISO_REMUNERADO',
  'PERMISO_NO_REMUNERADO',
  'LICENCIA',
  'CALAMIDAD',
];

// Novedad de asistencia de un colaborador: una ausencia justificada o un compensatorio (en horas).
export class AsistenciaNovedad extends Model {}

AsistenciaNovedad.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    colaboradorId: { type: DataTypes.INTEGER, allowNull: false, field: 'colaborador_id' },
    tipo: { type: DataTypes.ENUM(...TIPOS_NOVEDAD), allowNull: false },
    fechaDesde: { type: DataTypes.DATEONLY, allowNull: false, field: 'fecha_desde' },
    fechaHasta: { type: DataTypes.DATEONLY, allowNull: false, field: 'fecha_hasta' },
    horas: { type: DataTypes.DECIMAL(6, 2), allowNull: true },
    referencia: { type: DataTypes.STRING(100), allowNull: true },
    observaciones: { type: DataTypes.TEXT, allowNull: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'AsistenciaNovedad',
    tableName: 'asistencia_novedades',
    underscored: true,
    paranoid: true,
  },
);

export default AsistenciaNovedad;
