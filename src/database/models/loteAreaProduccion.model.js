import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class LoteAreaProduccion extends Model {}

LoteAreaProduccion.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    loteId: { type: DataTypes.INTEGER, allowNull: false, field: 'lote_id' },
    area: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    fechaRegistro: { type: DataTypes.DATEONLY, allowNull: false, field: 'fecha_registro' },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
  },
  {
    sequelize,
    modelName: 'LoteAreaProduccion',
    tableName: 'lote_area_produccion',
    underscored: true,
  },
);

export default LoteAreaProduccion;
