import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class HojaInfectada extends Model {}

HojaInfectada.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    infeccionId: { type: DataTypes.INTEGER, allowNull: false, field: 'infeccion_id' },
    numeroHoja: { type: DataTypes.INTEGER, allowNull: false, field: 'numero_hoja' },
    severidad: { type: DataTypes.INTEGER, allowNull: true },
    estadio: { type: DataTypes.INTEGER, allowNull: true },
    estado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
  },
  {
    sequelize,
    modelName: 'HojaInfectada',
    tableName: 'hojas_infectadas',
    underscored: true,
    paranoid: false,
  },
);

export default HojaInfectada;
