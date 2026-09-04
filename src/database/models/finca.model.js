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
    // Overrides de % aplicado por edad (8-12) en el estimado de corte de
    // racimos, guardados desde el panel de Estimaciones. Formato:
    // { "8": 0.06, "9": 12.05, "10": 45.91, "11": 30.87, "12": 11.1 }.
    patronCortePct: { type: DataTypes.JSON, allowNull: true, field: 'patron_corte_pct' },
    // Ratio (cajas por racimo cosechado) editado a mano por numeroSemana,
    // para "Sugerido próximas semanas" en el panel de Estimaciones. Formato:
    // { "37": 0.0285, "38": 0.03, ... }.
    ratioCajasPorSemana: { type: DataTypes.JSON, allowNull: true, field: 'ratio_cajas_por_semana' },
    // Perímetro de la finca para dibujar en el mapa de evaluaciones — array
    // de pares [lat, lng], normalmente importado desde un .kml de Google
    // Earth (ver PUT /fincas/:uuid). Null = sin perímetro cargado.
    perimetro: { type: DataTypes.JSON, allowNull: true },
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
