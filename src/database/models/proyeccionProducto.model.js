import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Producto del catálogo que participa en el reparto de cajas de un escenario de proyección, con su % de los kilos.
export class ProyeccionProducto extends Model {}

ProyeccionProducto.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    escenarioId: { type: DataTypes.INTEGER, allowNull: false, field: 'escenario_id' },
    productoId: { type: DataTypes.INTEGER, allowNull: false, field: 'producto_id' },
    // PORCENTAJE (% de los kilos) | CONTENEDORES (N contenedores por semana) | RESTO (lo que sobra)
    modo: { type: DataTypes.STRING(15), allowNull: false, defaultValue: 'PORCENTAJE' },
    porcentaje: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
    contenedores: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
    // Cajas por contenedor propias de este escenario (NULL = las del catálogo: cajas por palet × palets por contenedor).
    cajasContenedor: { type: DataTypes.DECIMAL(8, 2), allowNull: true, field: 'cajas_contenedor' },
    // Frecuencia de los contenedores fijos: cada N semanas (1 = todas; 2 = una sí y otra no), empezando en la semana `desdeSemana`.
    cadaSemanas: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, field: 'cada_semanas' },
    desdeSemana: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, field: 'desde_semana' },
    // Posición del producto en la tabla (0 = primero).
    orden: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
  },
  {
    sequelize,
    modelName: 'ProyeccionProducto',
    tableName: 'proyeccion_productos',
    underscored: true,
  },
);

export default ProyeccionProducto;
