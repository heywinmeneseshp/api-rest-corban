import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Ajuste de estimación hecho desde Precalibración. Independiente de EstimacionFinca (escalera): guardar aquí nunca
// modifica las estimaciones oficiales. Cada guardado es una versión; la última es la vigente.
export class PrecalibracionEstimacion extends Model {}

PrecalibracionEstimacion.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    fincaId: { type: DataTypes.INTEGER, allowNull: false, field: 'finca_id' },
    semanaId: { type: DataTypes.INTEGER, allowNull: false, field: 'semana_id' },
    racimosAptos: { type: DataTypes.INTEGER, allowNull: false, field: 'racimos_aptos' },
    ratio: { type: DataTypes.DECIMAL(8, 3), allowNull: true },
    cajas: { type: DataTypes.INTEGER, allowNull: false },
    estimacionCajas: { type: DataTypes.INTEGER, allowNull: true, field: 'estimacion_cajas' },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'PrecalibracionEstimacion',
    tableName: 'precalibracion_estimaciones',
    underscored: true,
    paranoid: true,
  },
);

export default PrecalibracionEstimacion;
