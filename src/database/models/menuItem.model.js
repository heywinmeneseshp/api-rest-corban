import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export const MENU_ITEM_TIPOS = ['modulo', 'pagina', 'boton'];

export class MenuItem extends Model {}

MenuItem.init(
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
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    tipo: {
      type: DataTypes.ENUM(...MENU_ITEM_TIPOS),
      allowNull: false,
      defaultValue: 'pagina',
    },
    parentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'parent_id',
    },
    ruta: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    icono: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    orden: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    permisoId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'permiso_id',
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
    modelName: 'MenuItem',
    tableName: 'menu_items',
    underscored: true,
    paranoid: true,
  },
);

export default MenuItem;
