import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Archivo (foto, carta de autorización, informe) de una orden de mantenimiento, guardado en Google Drive.
export class OrdenAdjunto extends Model {}

OrdenAdjunto.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    ordenId: { type: DataTypes.INTEGER, allowNull: false, field: 'orden_id' },
    hallazgoId: { type: DataTypes.INTEGER, allowNull: true, field: 'hallazgo_id' },
    checklistItemId: { type: DataTypes.INTEGER, allowNull: true, field: 'checklist_item_id' },
    // FOTO | CARTA_AUTORIZACION | INFORME
    tipo: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'FOTO' },
    idDrive: { type: DataTypes.STRING(100), allowNull: false, field: 'id_drive' },
    urlDrive: { type: DataTypes.STRING(500), allowNull: true, field: 'url_drive' },
    nombreOriginal: { type: DataTypes.STRING(255), allowNull: true, field: 'nombre_original' },
    mime: { type: DataTypes.STRING(100), allowNull: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
  },
  {
    sequelize,
    modelName: 'OrdenAdjunto',
    tableName: 'orden_adjuntos',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

export default OrdenAdjunto;
