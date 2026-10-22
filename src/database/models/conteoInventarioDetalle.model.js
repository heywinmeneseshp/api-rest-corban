import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Una línea de un conteo: un artículo con el saldo del sistema al crear el conteo, lo contado y, al cerrar, la diferencia.
export class ConteoInventarioDetalle extends Model {}

ConteoInventarioDetalle.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    conteoId: { type: DataTypes.INTEGER, allowNull: false, field: 'conteo_id' },
    articuloId: { type: DataTypes.INTEGER, allowNull: false, field: 'articulo_id' },
    saldoSistema: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0, field: 'saldo_sistema' },
    cantidadContada: { type: DataTypes.DECIMAL(14, 2), allowNull: true, field: 'cantidad_contada' },
    saldoCierre: { type: DataTypes.DECIMAL(14, 2), allowNull: true, field: 'saldo_cierre' },
    diferencia: { type: DataTypes.DECIMAL(14, 2), allowNull: true },
    movimientoId: { type: DataTypes.INTEGER, allowNull: true, field: 'movimiento_id' },
    observacion: { type: DataTypes.STRING(255), allowNull: true },
  },
  { sequelize, modelName: 'ConteoInventarioDetalle', tableName: 'conteos_inventario_detalle', underscored: true },
);

export default ConteoInventarioDetalle;
