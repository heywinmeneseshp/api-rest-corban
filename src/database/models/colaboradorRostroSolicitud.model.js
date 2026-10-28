import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Solicitud para volver a registrar un rostro ya enrolado. `muestras` guarda los vectores nuevos solo mientras está PENDIENTE;
// al aprobarla (reemplazan el rostro) o rechazarla se vacían. `parecido`: distancia mínima con el rostro actual.
export class ColaboradorRostroSolicitud extends Model {}

ColaboradorRostroSolicitud.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    colaboradorId: { type: DataTypes.INTEGER, allowNull: false, field: 'colaborador_id' },
    muestras: { type: DataTypes.JSON, allowNull: true },
    parecido: { type: DataTypes.DECIMAL(6, 4), allowNull: true },
    // PENDIENTE | APROBADA | RECHAZADA
    estado: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'PENDIENTE' },
    nota: { type: DataTypes.STRING(300), allowNull: true },
    solicitadoPor: { type: DataTypes.INTEGER, allowNull: true, field: 'solicitado_por' },
    resueltoPor: { type: DataTypes.INTEGER, allowNull: true, field: 'resuelto_por' },
    resueltoAt: { type: DataTypes.DATE, allowNull: true, field: 'resuelto_at' },
  },
  {
    sequelize,
    modelName: 'ColaboradorRostroSolicitud',
    tableName: 'colaborador_rostro_solicitudes',
    underscored: true,
  },
);

export default ColaboradorRostroSolicitud;
