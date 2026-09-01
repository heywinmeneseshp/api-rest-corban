import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class Motivo extends Model {}

Motivo.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    codigo: { type: DataTypes.STRING(50), allowNull: true },
    nombre: { type: DataTypes.STRING(150), allowNull: false },
    descripcion: { type: DataTypes.TEXT, allowNull: true },
    tipo: { type: DataTypes.ENUM('AJUSTE', 'SALIDA', 'TRANSFERENCIA', 'ELABORACION', 'OTRO'), allowNull: false, defaultValue: 'OTRO' },
    requiereObservacion: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'requiere_observacion' },
    estado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'Motivo',
    tableName: 'motivos',
    underscored: true,
    paranoid: true,
  },
);

export default Motivo;
