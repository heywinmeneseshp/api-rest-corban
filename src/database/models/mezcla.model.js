import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class Mezcla extends Model {}

Mezcla.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    codigo: { type: DataTypes.STRING(50), allowNull: true, unique: true },
    nombre: { type: DataTypes.STRING(150), allowNull: false, unique: true },
    descripcion: { type: DataTypes.TEXT, allowNull: true },
    productoElaboradoId: { type: DataTypes.INTEGER, allowNull: false, field: 'producto_elaborado_id' },
    unidadRendimientoId: { type: DataTypes.INTEGER, allowNull: true, field: 'unidad_rendimiento_id' },
    rendimiento: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 1 },
    precioVenta: { type: DataTypes.DECIMAL(12, 2), allowNull: true, defaultValue: 0, field: 'precio_venta' },
    estado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'Mezcla',
    tableName: 'mezclas',
    underscored: true,
    paranoid: true,
  },
);

export default Mezcla;
