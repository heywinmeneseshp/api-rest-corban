import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Una fila por cada insumo de la receta al momento de PROGRAMAR una
// aspersión — snapshot de "cuánto calcula la receta" (cantidadCalculada,
// fijo) y "cuánto se va a consumir de verdad" (cantidad, editable por el
// operador). ejecutar() descuenta stock según `cantidad`, no recalculando
// desde la mezcla en vivo (ver aspersionProgramacion.service.js).
export class AspersionProgramacionComponente extends Model {}

AspersionProgramacionComponente.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    aspersionProgramacionId: { type: DataTypes.INTEGER, allowNull: false, field: 'aspersion_programacion_id' },
    articuloId: { type: DataTypes.INTEGER, allowNull: false, field: 'articulo_id' },
    unidadId: { type: DataTypes.INTEGER, allowNull: true, field: 'unidad_id' },
    cantidadCalculada: { type: DataTypes.DECIMAL(12, 4), allowNull: false, field: 'cantidad_calculada' },
    cantidad: { type: DataTypes.DECIMAL(12, 4), allowNull: false },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
  },
  {
    sequelize,
    modelName: 'AspersionProgramacionComponente',
    tableName: 'aspersion_programacion_componentes',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

export default AspersionProgramacionComponente;
