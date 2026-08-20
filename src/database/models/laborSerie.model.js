import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export const MODOS_LOTES_LABOR_SERIE = ['UNICO', 'ROTACION', 'SIMULTANEO'];
export const FRECUENCIAS_LABOR_SERIE = ['DIARIA', 'SEMANAL', 'MENSUAL', 'ANUAL'];

export class LaborSerie extends Model {}

LaborSerie.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    laborId: { type: DataTypes.INTEGER, allowNull: false, field: 'labor_id' },
    fincaId: { type: DataTypes.INTEGER, allowNull: false, field: 'finca_id' },
    modoLotes: {
      type: DataTypes.ENUM(...MODOS_LOTES_LABOR_SERIE),
      allowNull: false,
      defaultValue: 'UNICO',
      field: 'modo_lotes',
    },
    loteId: { type: DataTypes.INTEGER, allowNull: true, field: 'lote_id' },
    fechaInicio: { type: DataTypes.DATEONLY, allowNull: false, field: 'fecha_inicio' },
    hora: { type: DataTypes.TIME, allowNull: true },
    duracionMinutos: { type: DataTypes.INTEGER, allowNull: true, field: 'duracion_minutos' },
    // Cuántos colaboradores hacen falta para esta labor — sin asignar a
    // nadie en particular. El pre-reparto por habilidad/calificación
    // (colaborador_labores) se hace más adelante, aparte.
    numeroColaboradores: { type: DataTypes.INTEGER, allowNull: true, field: 'numero_colaboradores' },
    observaciones: { type: DataTypes.STRING(500), allowNull: true },
    esRecurrente: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'es_recurrente' },
    frecuencia: { type: DataTypes.ENUM(...FRECUENCIAS_LABOR_SERIE), allowNull: true },
    intervalo: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    fechaFin: { type: DataTypes.DATEONLY, allowNull: true, field: 'fecha_fin' },
    numRepeticiones: { type: DataTypes.INTEGER, allowNull: true, field: 'num_repeticiones' },
    estado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'LaborSerie',
    tableName: 'labor_series',
    underscored: true,
    paranoid: true,
  },
);

export default LaborSerie;
