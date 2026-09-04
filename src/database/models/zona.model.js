import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Zona: agrupa varias fincas para reportes/organización (N:M real vía la
// tabla puente `zona_fincas` — a diferencia de GrupoFinca, que es 1:N y
// representa "misma finca operativa dividida en varios registros"; acá una
// finca sí puede pertenecer a más de una zona).
export class Zona extends Model {}

Zona.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    nombre: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    estado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  { sequelize, modelName: 'Zona', tableName: 'zonas', underscored: true, paranoid: true },
);

export default Zona;
