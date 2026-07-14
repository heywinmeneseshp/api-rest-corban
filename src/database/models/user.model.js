import { DataTypes, Model } from 'sequelize';
import bcrypt from 'bcrypt';
import { sequelize } from '../connection.js';

export class User extends Model {
  comparePassword(plainPassword) {
    return bcrypt.compare(plainPassword, this.password);
  }

  toSafeJSON() {
    const { password, ...safe } = this.toJSON();
    void password;
    return safe;
  }
}

User.init(
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
    usuario: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    apellido: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    estado: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
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
    modelName: 'User',
    tableName: 'users',
    underscored: true,
    paranoid: true,
    defaultScope: {
      attributes: { exclude: ['password'] },
    },
    scopes: {
      withPassword: {
        attributes: { include: ['password'] },
      },
    },
  },
);

export default User;
