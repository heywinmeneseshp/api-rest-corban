import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Participante de una aplicación con dron (comprobante de aspersión): el piloto y sus asistentes, del listado de colaboradores.
// Cada uno suma las hectáreas aplicadas del comprobante (se les paga por hectárea asperjada).
export class ComprobanteAspersionParticipante extends Model {}

ComprobanteAspersionParticipante.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    comprobanteId: { type: DataTypes.INTEGER, allowNull: false, field: 'comprobante_id' },
    colaboradorId: { type: DataTypes.INTEGER, allowNull: false, field: 'colaborador_id' },
    rol: { type: DataTypes.ENUM('PILOTO', 'ASISTENTE'), allowNull: false },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
  },
  {
    sequelize,
    modelName: 'ComprobanteAspersionParticipante',
    tableName: 'comprobante_aspersion_participantes',
    underscored: true,
  },
);

export default ComprobanteAspersionParticipante;
