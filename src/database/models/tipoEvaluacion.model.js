import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class TipoEvaluacion extends Model {}

TipoEvaluacion.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    nombre: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    descripcion: { type: DataTypes.STRING(255), allowNull: true },
    estado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'TipoEvaluacion',
    tableName: 'tipos_evaluacion',
    underscored: true,
    paranoid: true,
  },
);

export default TipoEvaluacion;
