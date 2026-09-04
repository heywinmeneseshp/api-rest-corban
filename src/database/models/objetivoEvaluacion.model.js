import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Meta semanal de cantidad de evaluaciones a cumplir, por finca o por lote
// (exactamente uno de los dos, validado en el servicio, no acá). Para el
// tipo "Conteo de Hojas" además se puede acotar a un rango de edad de la
// planta (semanas desde su embolse, ver utils/edadPlanta.js) — edadMinima/
// edadMaxima quedan null para los demás tipos.
export class ObjetivoEvaluacion extends Model {}

ObjetivoEvaluacion.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    tipoEvaluacionId: { type: DataTypes.INTEGER, allowNull: false, field: 'tipo_evaluacion_id' },
    fincaId: { type: DataTypes.INTEGER, allowNull: true, field: 'finca_id' },
    loteId: { type: DataTypes.INTEGER, allowNull: true, field: 'lote_id' },
    cantidad: { type: DataTypes.INTEGER, allowNull: false },
    edadMinima: { type: DataTypes.INTEGER, allowNull: true, field: 'edad_minima' },
    edadMaxima: { type: DataTypes.INTEGER, allowNull: true, field: 'edad_maxima' },
    estado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'ObjetivoEvaluacion',
    tableName: 'objetivos_evaluacion',
    underscored: true,
    paranoid: true,
  },
);

export default ObjetivoEvaluacion;
