import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Entidad independiente del `Producto` de Maestros/agrícola (combos de
// Logística) — antes compartían la misma tabla `productos`, lo que mezclaba
// dos conceptos distintos. `Articulo` es exclusivo de Inventarios.
export class Articulo extends Model {}

Articulo.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    codigo: { type: DataTypes.STRING(20), allowNull: true },
    nombre: { type: DataTypes.STRING(150), allowNull: false, unique: true },
    descripcion: { type: DataTypes.TEXT, allowNull: true },
    categoriaId: { type: DataTypes.INTEGER, allowNull: true, field: 'categoria_id' },
    unidadMedidaId: { type: DataTypes.INTEGER, allowNull: true, field: 'unidad_medida_id' },
    costoCompra: { type: DataTypes.DECIMAL(12, 2), allowNull: true, defaultValue: 0, field: 'costo_compra' },
    precioVenta: { type: DataTypes.DECIMAL(12, 2), allowNull: true, defaultValue: 0, field: 'precio_venta' },
    manejaInventario: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'maneja_inventario' },
    stockMinimo: { type: DataTypes.DECIMAL(12, 2), allowNull: true, defaultValue: 0, field: 'stock_minimo' },
    stockMaximo: { type: DataTypes.DECIMAL(12, 2), allowNull: true, field: 'stock_maximo' },
    estado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'Articulo',
    tableName: 'articulos',
    underscored: true,
    paranoid: true,
  },
);

export default Articulo;
