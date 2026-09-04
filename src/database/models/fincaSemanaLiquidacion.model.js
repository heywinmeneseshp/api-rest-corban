import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Marca que una finca ya "liquidó" (cerró el registro de movimientos de
// racimos de) una semana puntual. Además de usarse para calcular el Patrón
// de corte solo sobre semanas con datos completos, BLOQUEA de verdad crear/
// editar/eliminar movimientos de racimos de esa semana para esa finca
// (ver assertSemanaNoLiquidada en racimoMovimiento.service.js) — un
// Administrador (o quien tenga racimo_movimiento.editar_historico) puede
// saltarse ese bloqueo, y solo un Administrador puede reabrir la semana.
export class FincaSemanaLiquidacion extends Model {}

FincaSemanaLiquidacion.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    fincaId: { type: DataTypes.INTEGER, allowNull: false, field: 'finca_id' },
    semanaId: { type: DataTypes.INTEGER, allowNull: false, field: 'semana_id' },
    liquidadaEn: { type: DataTypes.DATE, allowNull: false, field: 'liquidada_en' },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'FincaSemanaLiquidacion',
    tableName: 'finca_semana_liquidaciones',
    underscored: true,
    paranoid: true,
  },
);

export default FincaSemanaLiquidacion;
