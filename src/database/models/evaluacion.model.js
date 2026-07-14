import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class Evaluacion extends Model {}

Evaluacion.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    plantaId: { type: DataTypes.INTEGER, allowNull: false, field: 'planta_id' },
    usuarioId: { type: DataTypes.INTEGER, allowNull: false, field: 'usuario_id' },
    tipoEvaluacionId: { type: DataTypes.INTEGER, allowNull: false, field: 'tipo_evaluacion_id' },
    semanaId: { type: DataTypes.INTEGER, allowNull: false, field: 'semana_id' },
    fecha: { type: DataTypes.DATEONLY, allowNull: false },
    observacion: { type: DataTypes.TEXT, allowNull: true },
    estado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
  },
  {
    sequelize,
    modelName: 'Evaluacion',
    tableName: 'evaluaciones',
    underscored: true,
    paranoid: false,
  },
);

export default Evaluacion;
