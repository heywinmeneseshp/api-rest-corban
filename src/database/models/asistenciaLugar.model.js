import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export const TIPOS_LUGAR = ['OFICINA', 'PLANTA', 'BODEGA', 'OTRO'];

// Lugar de asistencia distinto de una finca (oficina, planta, bodega...). Lo ve cualquiera con permiso de asistencia,
// sin importar sus fincas asignadas.
export class AsistenciaLugar extends Model {}

AsistenciaLugar.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    nombre: { type: DataTypes.STRING(120), allowNull: false },
    tipo: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'OFICINA' },
    direccion: { type: DataTypes.STRING(200), allowNull: true },
    lat: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    lng: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    estado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'AsistenciaLugar',
    tableName: 'asistencia_lugares',
    underscored: true,
    paranoid: true,
  },
);

export default AsistenciaLugar;
