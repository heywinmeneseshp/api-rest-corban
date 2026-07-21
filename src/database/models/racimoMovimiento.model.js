import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export const TIPOS_RACIMO_MOVIMIENTO = ['EMBOLSE', 'REPIQUE', 'RECUSE', 'PROCESADO'];

export class RacimoMovimiento extends Model {}

RacimoMovimiento.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    fincaId: { type: DataTypes.INTEGER, allowNull: false, field: 'finca_id' },
    loteId: { type: DataTypes.INTEGER, allowNull: false, field: 'lote_id' },
    semanaEmbolseId: { type: DataTypes.INTEGER, allowNull: false, field: 'semana_embolse_id' },
    semanaRegistroId: { type: DataTypes.INTEGER, allowNull: false, field: 'semana_registro_id' },
    tipo: { type: DataTypes.ENUM(...TIPOS_RACIMO_MOVIMIENTO), allowNull: false },
    motivoRepiqueId: { type: DataTypes.INTEGER, allowNull: true, field: 'motivo_repique_id' },
    motivoRecuseId: { type: DataTypes.INTEGER, allowNull: true, field: 'motivo_recuse_id' },
    cantidad: { type: DataTypes.INTEGER, allowNull: false },
    fecha: { type: DataTypes.DATEONLY, allowNull: false },
    observacion: { type: DataTypes.STRING(255), allowNull: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'RacimoMovimiento',
    tableName: 'racimo_movimientos',
    underscored: true,
    paranoid: true,
  },
);

export default RacimoMovimiento;
