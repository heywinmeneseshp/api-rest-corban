import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Hectáreas nuevas (o bajas, si es negativo) que una finca habilita desde una semana de entrada, dentro de un escenario.
export class ProyeccionArea extends Model {}

ProyeccionArea.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    escenarioId: { type: DataTypes.INTEGER, allowNull: false, field: 'escenario_id' },
    fincaId: { type: DataTypes.INTEGER, allowNull: false, field: 'finca_id' },
    semanaId: { type: DataTypes.INTEGER, allowNull: false, field: 'semana_id' },
    hectareas: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    nota: { type: DataTypes.STRING(255), allowNull: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
  },
  {
    sequelize,
    modelName: 'ProyeccionArea',
    tableName: 'proyeccion_areas',
    underscored: true,
  },
);

export default ProyeccionArea;
