import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Punto GPS de un recorrido de evaluación.
export class EvaluacionRecorridoPunto extends Model {}

EvaluacionRecorridoPunto.init(
  {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    recorridoId: { type: DataTypes.INTEGER, allowNull: false, field: 'recorrido_id' },
    lat: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
    lng: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
    precisionM: { type: DataTypes.DECIMAL(8, 2), allowNull: true, field: 'precision_m' },
    registradoAt: { type: DataTypes.DATE(3), allowNull: false, field: 'registrado_at' },
  },
  { sequelize, modelName: 'EvaluacionRecorridoPunto', tableName: 'evaluacion_recorrido_puntos', underscored: true, updatedAt: false },
);

export default EvaluacionRecorridoPunto;
