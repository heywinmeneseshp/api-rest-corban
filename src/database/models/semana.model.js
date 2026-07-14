import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class Semana extends Model {}

Semana.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    codigo: { type: DataTypes.STRING(20), allowNull: false, unique: true },
    numeroSemana: { type: DataTypes.INTEGER, allowNull: false, field: 'numero_semana' },
    anio: { type: DataTypes.INTEGER, allowNull: false },
    fechaInicio: { type: DataTypes.DATEONLY, allowNull: false, field: 'fecha_inicio' },
    fechaFin: { type: DataTypes.DATEONLY, allowNull: false, field: 'fecha_fin' },
    estado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'Semana',
    tableName: 'semanas',
    underscored: true,
    paranoid: true,
  },
);

export default Semana;
