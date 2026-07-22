import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class ProduccionSemanal extends Model {}

ProduccionSemanal.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    semanaId: { type: DataTypes.INTEGER, allowNull: false, field: 'semana_id' },
    fincaId: { type: DataTypes.INTEGER, allowNull: false, field: 'finca_id' },
    cajas20kg: { type: DataTypes.INTEGER, allowNull: false, field: 'cajas_20kg' },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'ProduccionSemanal',
    tableName: 'produccion_semanal',
    underscored: true,
    paranoid: true,
    indexes: [
      { unique: true, fields: ['semana_id', 'finca_id'] },
    ],
  },
);

export default ProduccionSemanal;
