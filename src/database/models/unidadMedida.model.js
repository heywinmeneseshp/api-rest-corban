import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class UnidadMedida extends Model {}

UnidadMedida.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    codigo: { type: DataTypes.STRING(20), allowNull: false, unique: true },
    nombre: { type: DataTypes.STRING(100), allowNull: false },
    simbolo: { type: DataTypes.STRING(20), allowNull: false },
    tipo: { type: DataTypes.ENUM('MASA', 'VOLUMEN', 'UNIDAD', 'LONGITUD', 'SUPERFICIE', 'TIEMPO', 'OTRO'), allowNull: false, defaultValue: 'OTRO' },
    estado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'UnidadMedida',
    tableName: 'unidades_medida',
    underscored: true,
    paranoid: true,
  },
);

export default UnidadMedida;
