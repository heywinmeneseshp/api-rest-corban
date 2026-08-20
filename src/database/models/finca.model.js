import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class Finca extends Model {}

Finca.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    codigo: { type: DataTypes.STRING(20), allowNull: false, unique: true },
    nombre: { type: DataTypes.STRING(150), allowNull: false },
    // Fincas que operativamente son una sola dividida en varios registros
    // (ej. "María Margarita" / "Marbella") comparten el mismo grupo — ver
    // utils/fincaScope.js `expandirFincaIds`/`expandirFincaUuids`.
    grupoFincaId: { type: DataTypes.INTEGER, allowNull: true, field: 'grupo_finca_id' },
    estado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    // Fincas que exportan cajas a través de nosotros (aparecen en
    // Programación de Corte) pero no son propias — no se les hace
    // seguimiento de labores, racimos, precipitación, etc. Se excluyen de
    // esos selectores vía fincaRepository/finca.service `soloOperativas`.
    esExterna: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'es_externa' },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'Finca',
    tableName: 'fincas',
    underscored: true,
    paranoid: true,
  },
);

export default Finca;
