import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class Labor extends Model {}

Labor.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    categoriaLaborId: { type: DataTypes.INTEGER, allowNull: false, field: 'categoria_labor_id' },
    nombre: { type: DataTypes.STRING(150), allowNull: false },
    color: { type: DataTypes.STRING(7), allowNull: false, defaultValue: '#16a34a' },
    icono: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'FiClipboard' },
    duracionDefaultMinutos: { type: DataTypes.INTEGER, allowNull: true, field: 'duracion_default_minutos' },
    estado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'Labor',
    tableName: 'labores',
    underscored: true,
    paranoid: true,
  },
);

export default Labor;
