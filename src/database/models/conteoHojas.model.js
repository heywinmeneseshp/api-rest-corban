import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class ConteoHojas extends Model {}

ConteoHojas.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    evaluacionId: { type: DataTypes.INTEGER, allowNull: false, unique: true, field: 'evaluacion_id' },
    semanaEmbolseId: { type: DataTypes.INTEGER, allowNull: false, field: 'semana_embolse_id' },
    hojasFuncionales: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'hojas_funcionales',
    },
    estado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
  },
  {
    sequelize,
    modelName: 'ConteoHojas',
    tableName: 'conteo_hojas',
    underscored: true,
    paranoid: false,
  },
);

export default ConteoHojas;
