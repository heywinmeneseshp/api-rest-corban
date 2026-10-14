import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Escenario de proyección anual: nombre, año y parámetros (rampa de hectáreas nuevas, % no cosechado, etc.).
export class ProyeccionEscenario extends Model {}

ProyeccionEscenario.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    nombre: { type: DataTypes.STRING(120), allowNull: false },
    anio: { type: DataTypes.INTEGER, allowNull: false },
    descripcion: { type: DataTypes.STRING(500), allowNull: true },
    params: { type: DataTypes.JSON, allowNull: false },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'ProyeccionEscenario',
    tableName: 'proyeccion_escenarios',
    underscored: true,
    paranoid: true,
  },
);

export default ProyeccionEscenario;
