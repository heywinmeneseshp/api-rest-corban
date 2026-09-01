import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class Almacen extends Model {}

Almacen.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    codigo: { type: DataTypes.STRING(20), allowNull: true },
    nombre: { type: DataTypes.STRING(150), allowNull: false, unique: true },
    descripcion: { type: DataTypes.TEXT, allowNull: true },
    tipo: { type: DataTypes.ENUM('ALMACEN', 'CENTRO_COSTO'), allowNull: false, defaultValue: 'ALMACEN' },
    parentId: { type: DataTypes.INTEGER, allowNull: true, field: 'parent_id' },
    ubicacionFincaId: { type: DataTypes.INTEGER, allowNull: true, field: 'ubicacion_finca_id' },
    responsableId: { type: DataTypes.INTEGER, allowNull: true, field: 'responsable_id' },
    estado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'Almacen',
    tableName: 'almacenes',
    underscored: true,
    paranoid: true,
  },
);

export default Almacen;
