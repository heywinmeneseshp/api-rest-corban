import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class MezclaComponente extends Model {}

MezclaComponente.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    mezclaVersionId: { type: DataTypes.INTEGER, allowNull: false, field: 'mezcla_version_id' },
    articuloId: { type: DataTypes.INTEGER, allowNull: false, field: 'articulo_id' },
    cantidad: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    unidadId: { type: DataTypes.INTEGER, allowNull: true, field: 'unidad_id' },
    costoUnitarioSnapshot: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: 'costo_unitario_snapshot' },
    costoTotalSnapshot: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: 'costo_total_snapshot' },
    // Insumo "principal" de la receta — selección única por versión (ver
    // mezcla.service.js#marcarComponentePrincipal). Por ahora solo se
    // guarda; qué lógica lo use se define más adelante.
    // Posición del insumo en la receta (se reordena arrastrando mientras no se
    // haya medido). Null = sin reordenar nunca: se usa el id (ver
    // utils/ordenReceta.js).
    orden: { type: DataTypes.INTEGER, allowNull: true },
    esPrincipal: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'es_principal' },
    // Dosis relativa: si se configura, la cantidad de este insumo es el
    // X% de la cantidad de OTRO artículo de la misma receta (ej. HIPOTENSOR
    // SYS = 1% del ACEITE BANOLE) — ver utils/dosisRelativa.js. La columna
    // `cantidad` guarda siempre el valor ya resuelto; estas dos solo
    // guardan la regla para recalcularlo cuando cambia la referencia.
    referenciaArticuloId: { type: DataTypes.INTEGER, allowNull: true, field: 'referencia_articulo_id' },
    porcentajeReferencia: { type: DataTypes.DECIMAL(8, 4), allowNull: true, field: 'porcentaje_referencia' },
    // Tipo de dosis del renglón: FIJA (cantidad fija), PORCENTAJE (X% de
    // otro insumo — usa referencia+porcentaje) o POR_VOLUMEN (tasa por cada
    // unidad de volumen de mezcla total preparada, ej. ANTIFOAM = 1 g por
    // galón — `tasa` va en la unidad del renglón y `tasaUnidadId` dice por
    // cada cuánto volumen; se resuelve con el total a preparar en cada
    // aspersión y en receta solo queda un estimado para costos/vistas).
    tipoDosis: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'FIJA', field: 'tipo_dosis' },
    tasa: { type: DataTypes.DECIMAL(12, 4), allowNull: true, field: 'tasa' },
    tasaUnidadId: { type: DataTypes.INTEGER, allowNull: true, field: 'tasa_unidad_id' },
    // Dosis de referencia del renglón (ej. ACEITE a 2.0/ha en una mezcla y
    // 1.5/ha en la mayoría): manda sobre la del artículo para % sobre
    // dosis, % aumento y "Ajustar dosis". Null = usar la del artículo.
    dosisPorHectarea: { type: DataTypes.DECIMAL(12, 4), allowNull: true, field: 'dosis_por_hectarea' },
    dosisUnidadId: { type: DataTypes.INTEGER, allowNull: true, field: 'dosis_unidad_id' },
  },
  {
    sequelize,
    modelName: 'MezclaComponente',
    tableName: 'mezcla_componentes',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

export default MezclaComponente;
