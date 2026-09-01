import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class Producto extends Model {}

Producto.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    // Código del combo en Logística (consecutivo), cuando aplica.
    codigo: { type: DataTypes.STRING(20), allowNull: true },
    nombre: { type: DataTypes.STRING(150), allowNull: false, unique: true },
    descripcion: { type: DataTypes.TEXT, allowNull: true },
    // El "tipo" de un producto (INSUMO/REPUESTO/ELABORADO/GENERAL) es
    // SIEMPRE el de su categoría — se eliminó la columna propia que
    // duplicaba el mismo ENUM sin ninguna validación que las mantuviera
    // sincronizadas (ver migración 20260901000001-remove-tipo-productos).
    categoriaId: { type: DataTypes.INTEGER, allowNull: true, field: 'categoria_id' },
    unidadMedidaId: { type: DataTypes.INTEGER, allowNull: true, field: 'unidad_medida_id' },
    costoCompra: { type: DataTypes.DECIMAL(12, 2), allowNull: true, defaultValue: 0, field: 'costo_compra' },
    precioVenta: { type: DataTypes.DECIMAL(12, 2), allowNull: true, defaultValue: 0, field: 'precio_venta' },
    manejaInventario: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'maneja_inventario' },
    stockMinimo: { type: DataTypes.DECIMAL(12, 2), allowNull: true, defaultValue: 0, field: 'stock_minimo' },
    stockMaximo: { type: DataTypes.DECIMAL(12, 2), allowNull: true, field: 'stock_maximo' },
    pesoNeto: { type: DataTypes.FLOAT, allowNull: true, field: 'peso_neto' },
    pesoBruto: { type: DataTypes.FLOAT, allowNull: true, field: 'peso_bruto' },
    cajasPorPalet: { type: DataTypes.INTEGER, allowNull: true, field: 'cajas_por_palet' },
    cajasPorMinipalet: { type: DataTypes.INTEGER, allowNull: true, field: 'cajas_por_minipalet' },
    cantidadPalets: { type: DataTypes.INTEGER, allowNull: true, field: 'cantidad_palets' },
    cantidadMinipalets: { type: DataTypes.INTEGER, allowNull: true, field: 'cantidad_minipalets' },
    estado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'Producto',
    tableName: 'productos',
    underscored: true,
    paranoid: true,
  },
);

export default Producto;
