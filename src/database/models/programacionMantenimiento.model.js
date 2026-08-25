import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class ProgramacionMantenimiento extends Model {}

ProgramacionMantenimiento.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    planId: { type: DataTypes.INTEGER, allowNull: true, field: 'plan_id' },
    equipoId: { type: DataTypes.INTEGER, allowNull: false, field: 'equipo_id' },
    fechaProgramada: { type: DataTypes.DATEONLY, allowNull: false, field: 'fecha_programada' },
    fechaEjecucion: { type: DataTypes.DATEONLY, allowNull: true, field: 'fecha_ejecucion' },
    responsableId: { type: DataTypes.INTEGER, allowNull: true, field: 'responsable_id' },
    estado: {
      type: DataTypes.ENUM('PENDIENTE', 'PROGRAMADA', 'EN_CURSO', 'COMPLETADA', 'CANCELADA', 'VENCIDA'),
      allowNull: false,
      defaultValue: 'PENDIENTE',
    },
    prioridad: {
      type: DataTypes.ENUM('BAJA', 'MEDIA', 'ALTA', 'CRITICA'),
      allowNull: false,
      defaultValue: 'MEDIA',
    },
    observaciones: { type: DataTypes.TEXT, allowNull: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'ProgramacionMantenimiento',
    tableName: 'programaciones_mantenimiento',
    underscored: true,
    paranoid: true,
  },
);

export default ProgramacionMantenimiento;
