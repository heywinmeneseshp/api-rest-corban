import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class Lote extends Model {}

Lote.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    fincaId: { type: DataTypes.INTEGER, allowNull: false, field: 'finca_id' },
    codigo: { type: DataTypes.STRING(20), allowNull: false },
    nombre: { type: DataTypes.STRING(150), allowNull: false },
    area: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    estado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'Lote',
    tableName: 'lotes',
    underscored: true,
    paranoid: true,
  },
);

export default Lote;
