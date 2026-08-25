import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class Equipo extends Model {}

Equipo.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    codigo: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    nombre: { type: DataTypes.STRING(150), allowNull: false },
    descripcion: { type: DataTypes.TEXT, allowNull: true },
    tipo: {
      type: DataTypes.ENUM('TRACTOR', 'VEHICULO', 'MAQUINARIA', 'EQUIPO', 'BOMBA', 'OTRO'),
      allowNull: false,
      defaultValue: 'OTRO',
    },
    marca: { type: DataTypes.STRING(100), allowNull: true },
    modelo: { type: DataTypes.STRING(100), allowNull: true },
    serie: { type: DataTypes.STRING(100), allowNull: true },
    fechaAdquisicion: { type: DataTypes.DATEONLY, allowNull: true, field: 'fecha_adquisicion' },
    ubicacionId: { type: DataTypes.INTEGER, allowNull: true, field: 'ubicacion_id' },
    centroCostoId: { type: DataTypes.INTEGER, allowNull: true, field: 'centro_costo_id' },
    estado: {
      type: DataTypes.ENUM('OPERATIVO', 'MANTENIMIENTO', 'FUERA_SERVICIO', 'INACTIVO', 'DE_BAJA'),
      allowNull: false,
      defaultValue: 'OPERATIVO',
    },
    horometro: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    kilometraje: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    responsableId: { type: DataTypes.INTEGER, allowNull: true, field: 'responsable_id' },
    observaciones: { type: DataTypes.TEXT, allowNull: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'Equipo',
    tableName: 'equipos',
    underscored: true,
    paranoid: true,
  },
);

export default Equipo;
