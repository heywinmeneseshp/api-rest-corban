import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Elemento geográfico de una finca importado de un .kmz/.kml (vía de cable,
// canal, parcela, riego…). `coordenadas`: polígono/línea → [[lat, lng], …];
// punto → [lat, lng].
export const CATEGORIAS_CAPA = ['VIA_CABLE', 'CANAL', 'PARCELA', 'RIEGO', 'TRINCHEO', 'PUNTO', 'OTRO'];

export class FincaCapaMapa extends Model {}

FincaCapaMapa.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    fincaId: { type: DataTypes.INTEGER, allowNull: false, field: 'finca_id' },
    loteId: { type: DataTypes.INTEGER, allowNull: true, field: 'lote_id' },
    categoria: { type: DataTypes.STRING(20), allowNull: false },
    subtipo: { type: DataTypes.STRING(40), allowNull: true },
    nombre: { type: DataTypes.STRING(150), allowNull: true },
    geometria: { type: DataTypes.STRING(10), allowNull: false },
    coordenadas: { type: DataTypes.JSON, allowNull: false },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  { sequelize, modelName: 'FincaCapaMapa', tableName: 'finca_capas_mapa', underscored: true, paranoid: true },
);

export default FincaCapaMapa;
