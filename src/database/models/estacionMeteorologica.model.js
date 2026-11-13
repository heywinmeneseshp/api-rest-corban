import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Estación meteorológica WeatherLink administrable desde la web. Las credenciales (api_key / api_secret) se guardan cifradas (ver utils/secretos.js) y
// nunca se devuelven a la web. Su `id` es el número que usa `estacion_clima_diaria.estacion`.
export class EstacionMeteorologica extends Model {}

EstacionMeteorologica.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    nombre: { type: DataTypes.STRING(120), allowNull: false },
    apiKey: { type: DataTypes.TEXT, allowNull: true, field: 'api_key' },
    apiSecret: { type: DataTypes.TEXT, allowNull: true, field: 'api_secret' },
    stationId: { type: DataTypes.STRING(60), allowNull: true, field: 'station_id' },
    estado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
  },
  {
    sequelize,
    modelName: 'EstacionMeteorologica',
    tableName: 'estaciones_meteorologicas',
    underscored: true,
    paranoid: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
  },
);

export default EstacionMeteorologica;
