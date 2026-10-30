import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Cargo (Maestros → Cargos): etiqueta que se asigna a usuarios y colaboradores. El nombre se copia en su columna `cargo` (lo leen
// las firmas de los documentos); al renombrar se actualiza en todos.
export class Cargo extends Model {}

Cargo.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    nombre: { type: DataTypes.STRING(150), allowNull: false },
    descripcion: { type: DataTypes.STRING(300), allowNull: true },
    estado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'Cargo',
    tableName: 'cargos',
    underscored: true,
    paranoid: true,
  },
);

export default Cargo;
