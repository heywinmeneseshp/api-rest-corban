import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Resumen de jornadas incompletas ya enviado a un superior por un día.
export class AsistenciaAvisoSuperior extends Model {}

AsistenciaAvisoSuperior.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    usuarioId: { type: DataTypes.INTEGER, allowNull: false, field: 'usuario_id' },
    fecha: { type: DataTypes.DATEONLY, allowNull: false },
    email: { type: DataTypes.STRING(150), allowNull: false },
  },
  {
    sequelize,
    modelName: 'AsistenciaAvisoSuperior',
    tableName: 'asistencia_avisos_superior',
    underscored: true,
  },
);

export default AsistenciaAvisoSuperior;
