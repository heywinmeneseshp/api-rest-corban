import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class EquipoComponente extends Model {}

EquipoComponente.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    equipoId: { type: DataTypes.INTEGER, allowNull: false, field: 'equipo_id' },
    articuloId: { type: DataTypes.INTEGER, allowNull: false, field: 'articulo_id' },
    notas: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    modelName: 'EquipoComponente',
    tableName: 'equipo_componentes',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

export default EquipoComponente;
