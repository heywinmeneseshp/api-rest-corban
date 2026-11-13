import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Finca que usa los datos de una estación meteorológica para su temperatura y humedad (una finca, una sola estación).
export class EstacionMeteorologicaFinca extends Model {}

EstacionMeteorologicaFinca.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    estacionId: { type: DataTypes.INTEGER, allowNull: false, field: 'estacion_id' },
    fincaId: { type: DataTypes.INTEGER, allowNull: false, unique: true, field: 'finca_id' },
  },
  {
    sequelize,
    modelName: 'EstacionMeteorologicaFinca',
    tableName: 'estacion_meteorologica_fincas',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

export default EstacionMeteorologicaFinca;
