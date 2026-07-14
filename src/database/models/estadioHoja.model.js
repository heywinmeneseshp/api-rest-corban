import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class EstadioHoja extends Model {}

EstadioHoja.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    sumaBrutaId: { type: DataTypes.INTEGER, allowNull: false, field: 'suma_bruta_id' },
    numeroHoja: { type: DataTypes.INTEGER, allowNull: false, field: 'numero_hoja' },
    estadio: { type: DataTypes.STRING(20), allowNull: true },
    estado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
  },
  {
    sequelize,
    modelName: 'EstadioHoja',
    tableName: 'estadios_hoja',
    underscored: true,
    paranoid: false,
  },
);

export default EstadioHoja;
