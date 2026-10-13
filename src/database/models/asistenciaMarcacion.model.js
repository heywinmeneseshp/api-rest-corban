import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export const TIPOS_MARCACION = ['ENTRADA', 'SALIDA'];

// Marcación de asistencia verificada por rostro. Solo guarda la distancia al mejor vector enrolado, nunca el vector
// ni una foto.
export class AsistenciaMarcacion extends Model {}

AsistenciaMarcacion.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    colaboradorId: { type: DataTypes.INTEGER, allowNull: false, field: 'colaborador_id' },
    fincaId: { type: DataTypes.INTEGER, allowNull: false, field: 'finca_id' },
    tipo: { type: DataTypes.ENUM(...TIPOS_MARCACION), allowNull: false },
    fechaHora: { type: DataTypes.DATE, allowNull: false, field: 'fecha_hora' },
    lat: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    lng: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    distancia: { type: DataTypes.DECIMAL(6, 4), allowNull: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'AsistenciaMarcacion',
    tableName: 'asistencia_marcaciones',
    underscored: true,
    paranoid: true,
  },
);

export default AsistenciaMarcacion;
