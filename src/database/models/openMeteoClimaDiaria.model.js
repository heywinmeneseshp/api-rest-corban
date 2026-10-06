import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Histórico diario de clima por finca traído de Open-Meteo (ver
// openMeteo.service.js) — aparte del histórico de la estación WeatherLink.
export class OpenMeteoClimaDiaria extends Model {}

OpenMeteoClimaDiaria.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    fincaId: { type: DataTypes.INTEGER, allowNull: false, field: 'finca_id' },
    fecha: { type: DataTypes.DATEONLY, allowNull: false },
    mm: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
    temperatura: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
    temperaturaMaxima: { type: DataTypes.DECIMAL(5, 2), allowNull: true, field: 'temperatura_maxima' },
    temperaturaMinima: { type: DataTypes.DECIMAL(5, 2), allowNull: true, field: 'temperatura_minima' },
    humedadRelativa: { type: DataTypes.DECIMAL(5, 2), allowNull: true, field: 'humedad_relativa' },
    vientoVelocidad: { type: DataTypes.DECIMAL(6, 2), allowNull: true, field: 'viento_velocidad' },
    vientoMax: { type: DataTypes.DECIMAL(6, 2), allowNull: true, field: 'viento_max' },
    // Radiación solar acumulada del día (MJ/m²) y evapotranspiración de
    // referencia FAO-56 (mm).
    radiacion: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
    et0: { type: DataTypes.DECIMAL(6, 2), allowNull: true },
    // Punto de la malla del modelo del que salió el dato (ver migración
    // 20261115000000): fincas con la misma celda comparten el mismo valor.
    celdaLatitud: { type: DataTypes.DECIMAL(9, 6), allowNull: true, field: 'celda_latitud' },
    celdaLongitud: { type: DataTypes.DECIMAL(9, 6), allowNull: true, field: 'celda_longitud' },
  },
  {
    sequelize,
    modelName: 'OpenMeteoClimaDiaria',
    tableName: 'open_meteo_clima_diaria',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

export default OpenMeteoClimaDiaria;
