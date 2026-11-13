import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Persona que participa en un servicio de mantenimiento (p. ej. colaboradores en entrenamiento).
export class OrdenParticipante extends Model {}

OrdenParticipante.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    ordenId: { type: DataTypes.INTEGER, allowNull: false, field: 'orden_id' },
    nombre: { type: DataTypes.STRING(150), allowNull: false },
    colaboradorId: { type: DataTypes.INTEGER, allowNull: true, field: 'colaborador_id' },
    // ENTRENAMIENTO | ACOMPANANTE
    rol: { type: DataTypes.STRING(15), allowNull: false, defaultValue: 'ENTRENAMIENTO' },
  },
  {
    sequelize,
    modelName: 'OrdenParticipante',
    tableName: 'orden_participantes',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

export default OrdenParticipante;
