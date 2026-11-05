import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Correo de jornada incompleta ya enviado a un colaborador por un día.
export class AsistenciaAvisoJornada extends Model {}

AsistenciaAvisoJornada.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    colaboradorId: { type: DataTypes.INTEGER, allowNull: false, field: 'colaborador_id' },
    fecha: { type: DataTypes.DATEONLY, allowNull: false },
    email: { type: DataTypes.STRING(150), allowNull: false },
  },
  {
    sequelize,
    modelName: 'AsistenciaAvisoJornada',
    tableName: 'asistencia_avisos_jornada',
    underscored: true,
  },
);

export default AsistenciaAvisoJornada;
