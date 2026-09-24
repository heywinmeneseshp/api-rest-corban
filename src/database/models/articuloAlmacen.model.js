import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Pivote N:M Articulo↔Almacen — mismo patrón que EquipoComponente
// (repuestos compatibles). Ver utils/almacenScope.js para el criterio de
// visibilidad: un artículo SIN filas acá es visible en todos los almacenes.
export class ArticuloAlmacen extends Model {}

ArticuloAlmacen.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    articuloId: { type: DataTypes.INTEGER, allowNull: false, field: 'articulo_id' },
    almacenId: { type: DataTypes.INTEGER, allowNull: false, field: 'almacen_id' },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
  },
  {
    sequelize,
    modelName: 'ArticuloAlmacen',
    tableName: 'articulo_almacenes',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

export default ArticuloAlmacen;
