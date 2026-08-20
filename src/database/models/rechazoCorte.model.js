import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Espejo de solo lectura de los Rechazos de Logística (fruta producida pero
// NO exportada) — se reemplaza por completo (borra+re-monta) en cada
// sincronización desde api-rest-banarica, así que no lleva auditoría propia
// ni soft-delete: el estado real vive allá.
export class RechazoCorte extends Model {}

RechazoCorte.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    fechaRechazo: { type: DataTypes.DATEONLY, allowNull: false, field: 'fecha_rechazo' },
    // Fecha real de cosecha — en Logística es la fecha en la que se llenó
    // el contenedor con esa fruta; en Corbana se llama "fecha de corte"
    // (coherente con Programación de Corte), distinta de fechaRechazo
    // (cuándo se detectó/registró el rechazo, que puede ser días después).
    fechaCorte: { type: DataTypes.DATEONLY, allowNull: true, field: 'fecha_corte' },
    fincaId: { type: DataTypes.INTEGER, allowNull: false, field: 'finca_id' },
    semanaId: { type: DataTypes.INTEGER, allowNull: false, field: 'semana_id' },
    productoId: { type: DataTypes.INTEGER, allowNull: true, field: 'producto_id' },
    cajas: { type: DataTypes.INTEGER, allowNull: false },
    motivo: { type: DataTypes.STRING(150), allowNull: true },
  },
  {
    sequelize,
    modelName: 'RechazoCorte',
    tableName: 'rechazos_corte',
    underscored: true,
    timestamps: true,
  },
);

export default RechazoCorte;
