import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Grupo químico (Triazoles, Morfolinas...): pertenece a un código FRAC.
export class GrupoQuimico extends Model {}

GrupoQuimico.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    nombre: { type: DataTypes.STRING(150), allowNull: false },
    fracCodigoId: { type: DataTypes.INTEGER, allowNull: false, field: 'frac_codigo_id' },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
  },
  { sequelize, modelName: 'GrupoQuimico', tableName: 'grupos_quimicos', underscored: true },
);

export default GrupoQuimico;
