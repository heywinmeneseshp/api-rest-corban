import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Configuración de Precalibración: edades y valores de calibrador. finca_id NULL = global; con finca = esa finca.
export class PrecalibracionConfig extends Model {}

PrecalibracionConfig.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    fincaId: { type: DataTypes.INTEGER, allowNull: true, unique: true, field: 'finca_id' },
    edades: { type: DataTypes.JSON, allowNull: false },
    valores: { type: DataTypes.JSON, allowNull: false },
    segundosEspera: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 10, field: 'segundos_espera' },
    modalidad: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'VIGENTE' },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
  },
  {
    sequelize,
    modelName: 'PrecalibracionConfig',
    tableName: 'precalibracion_config',
    underscored: true,
  },
);

export default PrecalibracionConfig;
