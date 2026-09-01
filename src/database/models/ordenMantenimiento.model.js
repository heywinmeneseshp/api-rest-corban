import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class OrdenMantenimiento extends Model {}

OrdenMantenimiento.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    numero: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    equipoId: { type: DataTypes.INTEGER, allowNull: false, field: 'equipo_id' },
    planId: { type: DataTypes.INTEGER, allowNull: true, field: 'plan_id' },
    programacionId: { type: DataTypes.INTEGER, allowNull: true, field: 'programacion_id' },
    tipo: {
      type: DataTypes.ENUM('PREVENTIVO', 'RUTINARIO', 'CORRECTIVO', 'PREDICTIVO', 'ADECUACION', 'OTRO'),
      allowNull: false,
      defaultValue: 'PREVENTIVO',
    },
    descripcion: { type: DataTypes.TEXT, allowNull: false },
    fecha: { type: DataTypes.DATEONLY, allowNull: false },
    fechaCierre: { type: DataTypes.DATEONLY, allowNull: true, field: 'fecha_cierre' },
    responsableId: { type: DataTypes.INTEGER, allowNull: true, field: 'responsable_id' },
    almacenId: { type: DataTypes.INTEGER, allowNull: true, field: 'almacen_id' },
    estado: {
      type: DataTypes.ENUM('ABIERTA', 'EN_PROCESO', 'CERRADA', 'CANCELADA'),
      allowNull: false,
      defaultValue: 'ABIERTA',
    },
    prioridad: {
      type: DataTypes.ENUM('BAJA', 'MEDIA', 'ALTA', 'CRITICA'),
      allowNull: false,
      defaultValue: 'MEDIA',
    },
    costoTotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: 'costo_total' },
    observaciones: { type: DataTypes.TEXT, allowNull: true },
    usuarioId: { type: DataTypes.INTEGER, allowNull: true, field: 'usuario_id' },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'OrdenMantenimiento',
    tableName: 'ordenes_mantenimiento',
    underscored: true,
    paranoid: true,
  },
);

export default OrdenMantenimiento;
