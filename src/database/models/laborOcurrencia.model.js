import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export const ESTADOS_LABOR_OCURRENCIA = ['PROGRAMADA', 'COMPLETADA', 'CANCELADA'];

export class LaborOcurrencia extends Model {}

LaborOcurrencia.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    serieId: { type: DataTypes.INTEGER, allowNull: false, field: 'serie_id' },
    fecha: { type: DataTypes.DATEONLY, allowNull: false },
    hora: { type: DataTypes.TIME, allowNull: true },
    duracionMinutos: { type: DataTypes.INTEGER, allowNull: true, field: 'duracion_minutos' },
    // Denormalizado desde la serie al generar la ocurrencia — ver comentario
    // en la migración de esta tabla.
    fincaId: { type: DataTypes.INTEGER, allowNull: false, field: 'finca_id' },
    loteId: { type: DataTypes.INTEGER, allowNull: false, field: 'lote_id' },
    laborId: { type: DataTypes.INTEGER, allowNull: false, field: 'labor_id' },
    responsableId: { type: DataTypes.INTEGER, allowNull: true, field: 'responsable_id' },
    observaciones: { type: DataTypes.STRING(500), allowNull: true },
    estado: {
      type: DataTypes.ENUM(...ESTADOS_LABOR_OCURRENCIA),
      allowNull: false,
      defaultValue: 'PROGRAMADA',
    },
    modificada: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'LaborOcurrencia',
    tableName: 'labor_ocurrencias',
    underscored: true,
    paranoid: true,
  },
);

export default LaborOcurrencia;
