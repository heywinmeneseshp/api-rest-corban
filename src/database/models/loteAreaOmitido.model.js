import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class LoteAreaOmitido extends Model {}

LoteAreaOmitido.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    loteId: { type: DataTypes.INTEGER, allowNull: false, field: 'lote_id' },
    fincaId: { type: DataTypes.INTEGER, allowNull: false, field: 'finca_id' },
    fechaObjetivo: { type: DataTypes.DATEONLY, allowNull: false, field: 'fecha_objetivo' },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
  },
  {
    sequelize,
    modelName: 'LoteAreaOmitido',
    tableName: 'lote_area_omitidos',
    underscored: true,
    paranoid: false,
  },
);

export default LoteAreaOmitido;