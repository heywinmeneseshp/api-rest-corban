import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Recorrido del evaluador en una finca (ver la migración 20261231000032). `fin` null = recorrido abierto.
export class EvaluacionRecorrido extends Model {}

EvaluacionRecorrido.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    usuarioId: { type: DataTypes.INTEGER, allowNull: false, field: 'usuario_id' },
    fincaId: { type: DataTypes.INTEGER, allowNull: false, field: 'finca_id' },
    inicio: { type: DataTypes.DATE(3), allowNull: false },
    fin: { type: DataTypes.DATE(3), allowNull: true },
  },
  { sequelize, modelName: 'EvaluacionRecorrido', tableName: 'evaluacion_recorridos', underscored: true },
);

export default EvaluacionRecorrido;
