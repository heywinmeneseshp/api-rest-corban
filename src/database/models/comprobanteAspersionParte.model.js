import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Cada ejecución (completa o parcial) incluida en un comprobante de aspersión: fecha, hectáreas y observaciones de esa parte.
export class ComprobanteAspersionParte extends Model {}

ComprobanteAspersionParte.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    comprobanteId: { type: DataTypes.INTEGER, allowNull: false, field: 'comprobante_id' },
    aspersionProgramacionId: { type: DataTypes.INTEGER, allowNull: false, field: 'aspersion_programacion_id' },
    fecha: { type: DataTypes.DATEONLY, allowNull: false },
    hectareas: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    observaciones: { type: DataTypes.TEXT, allowNull: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
  },
  {
    sequelize,
    modelName: 'ComprobanteAspersionParte',
    tableName: 'comprobante_aspersion_partes',
    underscored: true,
  },
);

export default ComprobanteAspersionParte;
