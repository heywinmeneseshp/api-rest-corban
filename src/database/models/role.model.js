import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class Role extends Model {}

Role.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    uuid: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      unique: true,
    },
    nombre: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    descripcion: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'created_by',
    },
    updatedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'updated_by',
    },
    deletedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'deleted_by',
    },
  },
  {
    sequelize,
    modelName: 'Role',
    tableName: 'roles',
    underscored: true,
    paranoid: true,
  },
);

export default Role;
