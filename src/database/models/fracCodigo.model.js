import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Código FRAC (3, 7, 11, M03, BM02...) con su modo de acción y el límite de
// aplicaciones por finca en los últimos 12 meses (NULL = sin límite).
export class FracCodigo extends Model {}

FracCodigo.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    codigo: { type: DataTypes.STRING(10), allowNull: false, unique: true },
    modoAccion: { type: DataTypes.STRING(255), allowNull: true, field: 'modo_accion' },
    maxAplicaciones: { type: DataTypes.INTEGER, allowNull: true, field: 'max_aplicaciones' },
    // % máximo de las aplicaciones del periodo que pueden ser de este grupo (FRAC: 50 o 33).
    maxPorcentajeAplicaciones: { type: DataTypes.DECIMAL(5, 2), allowNull: true, field: 'max_porcentaje_aplicaciones' },
    // Reglas de secuencia del FRAC: aplicaciones seguidas permitidas, días libres mínimos y uso solo en mezclas.
    maxConsecutivas: { type: DataTypes.INTEGER, allowNull: true, field: 'max_consecutivas' },
    intervaloMinimoDias: { type: DataTypes.INTEGER, allowNull: true, field: 'intervalo_minimo_dias' },
    soloEnMezclas: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'solo_en_mezclas' },
    // Restricciones de uso (texto) y su fuente.
    restricciones: { type: DataTypes.TEXT, allowNull: true },
    fuente: { type: DataTypes.STRING(255), allowNull: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
  },
  { sequelize, modelName: 'FracCodigo', tableName: 'frac_codigos', underscored: true },
);

export default FracCodigo;
