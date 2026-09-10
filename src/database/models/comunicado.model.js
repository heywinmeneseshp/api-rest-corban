import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Historial de correos/comunicados enviados manualmente desde Configuración
// → Comunicados. Es un log inmutable (no se edita ni se borra), por eso no
// tiene updated_by/deleted_by/paranoid como las entidades normales.
export class Comunicado extends Model {}

Comunicado.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    asunto: { type: DataTypes.STRING(200), allowNull: false },
    mensaje: { type: DataTypes.TEXT, allowNull: false },
    destinatariosResumen: { type: DataTypes.JSON, allowNull: true, field: 'destinatarios_resumen' },
    resultados: { type: DataTypes.JSON, allowNull: true },
    // Metadata de los adjuntos mandados: [{ nombre, tamanioBytes, tipo }].
    // El contenido binario nunca se guarda, solo pasa en memoria al enviar.
    adjuntos: { type: DataTypes.JSON, allowNull: true },
    totalDestinatarios: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'total_destinatarios' },
    enviadosOk: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'enviados_ok' },
    enviadosError: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'enviados_error' },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
  },
  {
    sequelize,
    modelName: 'Comunicado',
    tableName: 'comunicados',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  },
);

export default Comunicado;
