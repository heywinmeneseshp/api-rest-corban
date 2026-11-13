import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Parte o accesorio con serie de un equipo (batería, control remoto, cargador, antena...), asignable a una aeronave. No es lo mismo que equipo_componentes (repuestos compatibles).
export class ParteEquipo extends Model {}

ParteEquipo.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    equipoId: { type: DataTypes.INTEGER, allowNull: true, field: 'equipo_id' },
    // BATERIA | CONTROL_REMOTO | CARGADOR | ANTENA | OTRO
    tipo: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'OTRO' },
    codigo: { type: DataTypes.STRING(60), allowNull: false },
    serie: { type: DataTypes.STRING(100), allowNull: true },
    descripcion: { type: DataTypes.STRING(200), allowNull: true },
    // ACTIVA | EN_REVISION | RETIRADA
    estado: { type: DataTypes.STRING(15), allowNull: false, defaultValue: 'ACTIVA' },
    ciclos: { type: DataTypes.DECIMAL(10, 0), allowNull: false, defaultValue: 0 },
    observaciones: { type: DataTypes.TEXT, allowNull: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
  },
  {
    sequelize,
    modelName: 'ParteEquipo',
    tableName: 'partes_equipo',
    underscored: true,
    paranoid: true,
    deletedAt: 'deleted_at',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

export default ParteEquipo;
