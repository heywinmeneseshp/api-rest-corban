import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class SumaBruta extends Model {}

SumaBruta.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    evaluacionId: { type: DataTypes.INTEGER, allowNull: false, unique: true, field: 'evaluacion_id' },
    hojasFuncionales: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'hojas_funcionales',
    },
    candela: { type: DataTypes.DECIMAL(6, 2), allowNull: true },
    estado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
  },
  {
    sequelize,
    modelName: 'SumaBruta',
    tableName: 'suma_bruta',
    underscored: true,
    paranoid: false,
  },
);

export default SumaBruta;
