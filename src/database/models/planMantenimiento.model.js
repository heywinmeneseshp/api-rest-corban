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
    // Planes por km / horas: lectura del equipo en el último mantenimiento (de ahí se cuenta la periodicidad) y último estado ya avisado por correo.
    // Plantilla de checklist que se copia a cada orden de este plan (opcional).
    plantillaId: { type: DataTypes.INTEGER, allowNull: true, field: 'plantilla_id' },
    // Planes por días / meses: fecha del último mantenimiento (de ahí se cuenta la periodicidad).
    fechaUltimo: { type: DataTypes.DATEONLY, allowNull: true, field: 'fecha_ultimo' },
    lecturaBase: { type: DataTypes.DECIMAL(12, 2), allowNull: true, field: 'lectura_base' },
    avisoEstado: { type: DataTypes.STRING(10), allowNull: true, field: 'aviso_estado' },
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
