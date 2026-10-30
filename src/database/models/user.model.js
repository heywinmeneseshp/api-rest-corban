import { DataTypes, Model } from 'sequelize';
import bcrypt from 'bcrypt';
import { sequelize } from '../connection.js';

export class User extends Model {
  comparePassword(plainPassword) {
    return bcrypt.compare(plainPassword, this.password);
  }

  // Sin la contraseña ni el id interno de la firma en Drive (solo si tiene firma y desde cuándo).
  toSafeJSON() {
    const { password, firmaDriveId, ...safe } = this.toJSON();
    void password;
    return { ...safe, tieneFirma: Boolean(firmaDriveId) };
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
    // Cargo/puesto de trabajo (ej. "Ingeniero Agrónomo", "Supervisor de
    // Campo") — distinto del rol (que es el mecanismo de permisos). Se usa
    // para las firmas de documentos (ver laborCultural.service.js), donde
    // se firma con el cargo real de la persona, no con el nombre técnico
    // del rol del sistema.
    cargo: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    // Firma (PNG) para los documentos: id del archivo en Google Drive (Firmas_Usuarios) y cuándo se subió.
    firmaDriveId: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'firma_drive_id',
    },
    firmaActualizadaEn: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'firma_actualizada_en',
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
