import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class PlanMantenimiento extends Model {}

PlanMantenimiento.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    equipoId: { type: DataTypes.INTEGER, allowNull: false, field: 'equipo_id' },
    nombre: { type: DataTypes.STRING(150), allowNull: false },
    descripcion: { type: DataTypes.TEXT, allowNull: true },
    tipo: {
      type: DataTypes.ENUM('PREVENTIVO', 'RUTINARIO', 'CORRECTIVO', 'PREDICTIVO', 'ADECUACION', 'OTRO'),
      allowNull: false,
      defaultValue: 'PREVENTIVO',
    },
    periodicidadValor: { type: DataTypes.INTEGER, allowNull: false, field: 'periodicidad_valor' },
    periodicidadUnidad: {
      type: DataTypes.ENUM('DIAS', 'HORAS', 'KILOMETROS', 'HOROMETRO', 'MESES'),
      allowNull: false,
      defaultValue: 'DIAS',
      field: 'periodicidad_unidad',
    },
    estado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'PlanMantenimiento',
    tableName: 'planes_mantenimiento',
    underscored: true,
    paranoid: true,
  },
);

export default PlanMantenimiento;
