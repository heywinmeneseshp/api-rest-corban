import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Catálogo editable de tipos de equipo — antes era un ENUM fijo en código
// (TRACTOR/VEHICULO/MAQUINARIA/EQUIPO/BOMBA/OTRO), ahora el usuario puede
// crear los que necesite desde un modal en el formulario de Equipos.
export class EquipoTipo extends Model {}

EquipoTipo.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    nombre: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    estado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'EquipoTipo',
    tableName: 'equipo_tipos',
    underscored: true,
    paranoid: true,
  },
);

export default EquipoTipo;
