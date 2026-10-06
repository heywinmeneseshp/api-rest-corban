import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Pivote N:M Articulo↔IngredienteActivo — mismo patrón que
// ArticuloAlmacen. Opcional: un artículo puede no tener ninguno.
export class ArticuloIngredienteActivo extends Model {}

ArticuloIngredienteActivo.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    articuloId: { type: DataTypes.INTEGER, allowNull: false, field: 'articulo_id' },
    ingredienteActivoId: { type: DataTypes.INTEGER, allowNull: false, field: 'ingrediente_activo_id' },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
  },
  {
    sequelize,
    modelName: 'ArticuloIngredienteActivo',
    tableName: 'articulo_ingredientes_activos',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

export default ArticuloIngredienteActivo;
