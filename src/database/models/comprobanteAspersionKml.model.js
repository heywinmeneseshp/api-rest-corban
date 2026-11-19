import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Recorridos (archivos KML) de un comprobante de aspersión: puede tener varios (p. ej. un vuelo por dron o por lote). Cada uno
// guarda el archivo original y la geometría simplificada que calculó el navegador; su mapa sale en una hoja del PDF.
export class ComprobanteAspersionKml extends Model {}

ComprobanteAspersionKml.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    comprobanteId: { type: DataTypes.INTEGER, allowNull: false, field: 'comprobante_id' },
    nombre: { type: DataTypes.STRING(200), allowNull: false },
    kml: { type: DataTypes.TEXT('long'), allowNull: false },
    geometria: { type: DataTypes.JSON, allowNull: true },
    subidoEn: { type: DataTypes.DATE, allowNull: false, field: 'subido_en' },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
  },
  {
    sequelize,
    modelName: 'ComprobanteAspersionKml',
    tableName: 'comprobante_aspersion_kmls',
    underscored: true,
  },
);

export default ComprobanteAspersionKml;
