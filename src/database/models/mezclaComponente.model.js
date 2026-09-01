import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class MezclaComponente extends Model {}

MezclaComponente.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    mezclaVersionId: { type: DataTypes.INTEGER, allowNull: false, field: 'mezcla_version_id' },
    articuloId: { type: DataTypes.INTEGER, allowNull: false, field: 'articulo_id' },
    cantidad: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    unidadId: { type: DataTypes.INTEGER, allowNull: true, field: 'unidad_id' },
    costoUnitarioSnapshot: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: 'costo_unitario_snapshot' },
    costoTotalSnapshot: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: 'costo_total_snapshot' },
  },
  {
    sequelize,
    modelName: 'MezclaComponente',
    tableName: 'mezcla_componentes',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

export default MezclaComponente;
