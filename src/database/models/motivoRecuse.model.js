import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class MotivoRecuse extends Model {}

MotivoRecuse.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    nombre: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    descripcion: { type: DataTypes.STRING(255), allowNull: true },
    // Código que espera el sistema externo al que se exportan los reportes
    // semanales de racimos (columna "Novedad").
    codigoExterno: { type: DataTypes.STRING(50), allowNull: true, field: 'codigo_externo' },
    estado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'MotivoRecuse',
    tableName: 'motivos_recuse',
    underscored: true,
    paranoid: true,
  },
);

export default MotivoRecuse;
