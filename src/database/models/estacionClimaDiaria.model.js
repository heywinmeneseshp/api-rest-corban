import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Histórico diario de la Estación Meteorológica (WeatherLink) — módulo
// aparte, no relacionado a Clima ni Precipitación Diaria (ver
// estacionMeteorologica.service.js).
export class EstacionClimaDiaria extends Model {}

EstacionClimaDiaria.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    fecha: { type: DataTypes.DATEONLY, allowNull: false, unique: true },
    mm: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
    temperatura: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
    humedadRelativa: { type: DataTypes.DECIMAL(5, 2), allowNull: true, field: 'humedad_relativa' },
  },
  {
    sequelize,
    modelName: 'EstacionClimaDiaria',
    tableName: 'estacion_clima_diaria',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

export default EstacionClimaDiaria;
