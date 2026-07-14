import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class Planta extends Model {}

Planta.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    loteId: { type: DataTypes.INTEGER, allowNull: false, field: 'lote_id' },
    codigo: { type: DataTypes.STRING(30), allowNull: false },
    categoriaPlantaId: { type: DataTypes.INTEGER, allowNull: false, field: 'categoria_planta_id' },
    latitud: { type: DataTypes.DECIMAL(10, 8), allowNull: true },
    longitud: { type: DataTypes.DECIMAL(11, 8), allowNull: true },
    estado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'Planta',
    tableName: 'plantas',
    underscored: true,
    paranoid: true,
  },
);

export default Planta;
