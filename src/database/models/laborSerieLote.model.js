import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Tabla de detalle: lista de lotes de una labor_series en modo ROTACION o
// SIMULTANEO. Sin uuid ni soft-delete propios, vive y muere con la serie.
export class LaborSerieLote extends Model {}

LaborSerieLote.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    laborSerieId: { type: DataTypes.INTEGER, allowNull: false, field: 'labor_serie_id' },
    loteId: { type: DataTypes.INTEGER, allowNull: false, field: 'lote_id' },
    // Secuencia round-robin en modo ROTACION; se ignora en SIMULTANEO.
    orden: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  {
    sequelize,
    modelName: 'LaborSerieLote',
    tableName: 'labor_serie_lotes',
    underscored: true,
    timestamps: true,
  },
);

export default LaborSerieLote;
