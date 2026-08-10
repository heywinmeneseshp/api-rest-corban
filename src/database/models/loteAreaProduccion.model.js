import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class LoteAreaProduccion extends Model {}

LoteAreaProduccion.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    loteId: { type: DataTypes.INTEGER, allowNull: false, field: 'lote_id' },
    area: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    // Área total del lote en el momento de este registro (distinta de
    // `area`, que es el área EN PRODUCCIÓN). Nullable: solo se completa
    // cuando el registro viene de confirmar una campaña de Área de Lotes
    // (ver LoteAreaConfig) — el alta manual/voluntaria puede seguir sin ella.
    areaTotal: { type: DataTypes.DECIMAL(10, 2), allowNull: true, field: 'area_total' },
    fechaRegistro: { type: DataTypes.DATEONLY, allowNull: false, field: 'fecha_registro' },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
  },
  {
    sequelize,
    modelName: 'LoteAreaProduccion',
    tableName: 'lote_area_produccion',
    underscored: true,
  },
);

export default LoteAreaProduccion;
