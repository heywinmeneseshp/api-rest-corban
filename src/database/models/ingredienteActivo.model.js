import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class IngredienteActivo extends Model {}

IngredienteActivo.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    nombre: { type: DataTypes.STRING(150), allowNull: false, unique: true },
    descripcion: { type: DataTypes.STRING(255), allowNull: true },
    // Clasificación FRAC: el ingrediente apunta a su grupo químico, y este al código FRAC.
    grupoQuimicoId: { type: DataTypes.INTEGER, allowNull: true, field: 'grupo_quimico_id' },
    estado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'IngredienteActivo',
    tableName: 'ingredientes_activos',
    underscored: true,
    paranoid: true,
  },
);

export default IngredienteActivo;
