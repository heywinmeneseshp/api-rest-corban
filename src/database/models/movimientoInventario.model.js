import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class MovimientoInventario extends Model {}

MovimientoInventario.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    documento: { type: DataTypes.STRING(50), allowNull: false },
    tipo: {
      type: DataTypes.ENUM('ENTRADA', 'SALIDA', 'AJUSTE_ENTRADA', 'AJUSTE_SALIDA', 'TRANSFERENCIA_SALIDA', 'TRANSFERENCIA_ENTRADA', 'ELABORACION_SALIDA', 'ELABORACION_ENTRADA'),
      allowNull: false,
    },
    fecha: { type: DataTypes.DATEONLY, allowNull: false },
    almacenId: { type: DataTypes.INTEGER, allowNull: false, field: 'almacen_id' },
    productoId: { type: DataTypes.INTEGER, allowNull: false, field: 'producto_id' },
    cantidad: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    cantidadBase: { type: DataTypes.DECIMAL(12, 2), allowNull: false, field: 'cantidad_base' },
    unidadId: { type: DataTypes.INTEGER, allowNull: true, field: 'unidad_id' },
    costoUnitario: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: 'costo_unitario' },
    costoTotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: 'costo_total' },
    lote: { type: DataTypes.STRING(50), allowNull: true },
    fechaVencimiento: { type: DataTypes.DATEONLY, allowNull: true, field: 'fecha_vencimiento' },
    motivoId: { type: DataTypes.INTEGER, allowNull: true, field: 'motivo_id' },
    observaciones: { type: DataTypes.TEXT, allowNull: true },
    usuarioId: { type: DataTypes.INTEGER, allowNull: true, field: 'usuario_id' },
    origenMovimientoId: { type: DataTypes.INTEGER, allowNull: true, field: 'origen_movimiento_id' },
  },
  {
    sequelize,
    modelName: 'MovimientoInventario',
    tableName: 'movimientos_inventario',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

export default MovimientoInventario;
