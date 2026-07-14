import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class Infeccion extends Model {}

Infeccion.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    evaluacionId: { type: DataTypes.INTEGER, allowNull: false, unique: true, field: 'evaluacion_id' },
    hojasTotales: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'hojas_totales' },
    yli: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    yls: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    estado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
  },
  {
    sequelize,
    modelName: 'Infeccion',
    tableName: 'infecciones',
    underscored: true,
    paranoid: false,
  },
);

export default Infeccion;
