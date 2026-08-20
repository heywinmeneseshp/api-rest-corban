import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Calificación (1-5) de un Colaborador en una Labor puntual — de acá sale
// la lista de responsables sugeridos al programar esa labor. Reemplazo
// total (destroy + bulkCreate) al editar el colaborador, no updates
// puntuales — mismo patrón que estadios_hoja/hojas_infectadas.
export class ColaboradorLabor extends Model {}

ColaboradorLabor.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    colaboradorId: { type: DataTypes.INTEGER, allowNull: false, field: 'colaborador_id' },
    laborId: { type: DataTypes.INTEGER, allowNull: false, field: 'labor_id' },
    calificacion: { type: DataTypes.INTEGER, allowNull: false },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
  },
  {
    sequelize,
    modelName: 'ColaboradorLabor',
    tableName: 'colaborador_labores',
    underscored: true,
    paranoid: false,
  },
);

export default ColaboradorLabor;
