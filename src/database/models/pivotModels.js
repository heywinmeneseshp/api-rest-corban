import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class UsuarioRol extends Model {}

UsuarioRol.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
    },
    roleId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'role_id',
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'created_by',
    },
  },
  {
    sequelize,
    modelName: 'UsuarioRol',
    tableName: 'usuarios_roles',
    underscored: true,
    timestamps: true,
    updatedAt: false,
  },
);

export class UsuarioFinca extends Model {}

UsuarioFinca.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
    },
    fincaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'finca_id',
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'created_by',
    },
  },
  {
    sequelize,
    modelName: 'UsuarioFinca',
    tableName: 'usuario_fincas',
    underscored: true,
    timestamps: true,
    updatedAt: false,
  },
);

export class ZonaFinca extends Model {}

ZonaFinca.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    zonaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'zona_id',
    },
    fincaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'finca_id',
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'created_by',
    },
  },
  {
    sequelize,
    modelName: 'ZonaFinca',
    tableName: 'zona_fincas',
    underscored: true,
    timestamps: true,
    updatedAt: false,
  },
);

export class RolPermiso extends Model {}

RolPermiso.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    roleId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'role_id',
    },
    permisoId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'permiso_id',
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'created_by',
    },
  },
  {
    sequelize,
    modelName: 'RolPermiso',
    tableName: 'rol_permisos',
    underscored: true,
    timestamps: true,
    updatedAt: false,
  },
);

export default { UsuarioRol, RolPermiso, UsuarioFinca };
