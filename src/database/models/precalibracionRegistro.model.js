import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Un racimo apto de la precalibración (cumple la medida del calibrador físico), con hora y GPS. La cinta no se
// guarda: es la semana de embolse (color y edad se derivan, ver utils/semanaColor.js y el servicio).
export class PrecalibracionRegistro extends Model {}

PrecalibracionRegistro.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    fincaId: { type: DataTypes.INTEGER, allowNull: false, field: 'finca_id' },
    loteId: { type: DataTypes.INTEGER, allowNull: false, field: 'lote_id' },
    semanaEmbolseId: { type: DataTypes.INTEGER, allowNull: false, field: 'semana_embolse_id' },
    semanaId: { type: DataTypes.INTEGER, allowNull: false, field: 'semana_id' },
    sesionId: { type: DataTypes.INTEGER, allowNull: true, field: 'sesion_id' },
    valor: { type: DataTypes.STRING(10), allowNull: false },
    fechaHora: { type: DataTypes.DATE, allowNull: false, field: 'fecha_hora' },
    lat: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    lng: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'PrecalibracionRegistro',
    tableName: 'precalibracion_registros',
    underscored: true,
    paranoid: true,
  },
);

export default PrecalibracionRegistro;
