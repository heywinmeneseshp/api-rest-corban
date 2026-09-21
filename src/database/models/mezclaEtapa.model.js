import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Una fila por medición ACUMULATIVA de una prueba de mezcla (ver
// mezcla.service.js): "Lanzador" → medición, "+Ilustre" → medición,
// "+Sulfato" → medición final. `resultado` se calcula y persiste al
// registrar la etapa contra los parámetros vigentes en ese momento — no se
// recalcula después, para que el historial no cambie si la configuración
// cambia más adelante.
export class MezclaEtapa extends Model {}

MezclaEtapa.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    mezclaVersionId: { type: DataTypes.INTEGER, allowNull: false, field: 'mezcla_version_id' },
    numero: { type: DataTypes.INTEGER, allowNull: false },
    componenteId: { type: DataTypes.INTEGER, allowNull: true, field: 'componente_id' },
    ph: { type: DataTypes.DECIMAL(4, 2), allowNull: false },
    ce: { type: DataTypes.DECIMAL(6, 2), allowNull: false },
    resultado: { type: DataTypes.ENUM('CUMPLE', 'NO_CUMPLE'), allowNull: false },
    // Detalle de qué condición falló — el pH se puede corregir con el
    // Regulador de pH, la CE no tiene forma de corregirse en esta prueba.
    // El frontend usa esto para bloquear "Corrección de pH" cuando es la
    // CE la que no cumple (no alcanza con mirar solo `resultado`).
    cumplePh: { type: DataTypes.BOOLEAN, allowNull: true, field: 'cumple_ph' },
    cumpleCe: { type: DataTypes.BOOLEAN, allowNull: true, field: 'cumple_ce' },
    // MEDICION (default): etapa normal, puede o no incorporar un
    // componenteId de la receta. CORRECCION_PH: se usó un insumo puntual
    // (ej. regulador de pH) para ajustar el pH — ese insumo NUNCA se
    // agrega a mezcla_componentes (no debe formar parte de la receta
    // permanente del elaborado), se descuenta solo una vez al finalizar
    // la prueba (ver mezcla.service.js#finalizar).
    tipoEtapa: { type: DataTypes.ENUM('MEDICION', 'CORRECCION_PH'), allowNull: false, defaultValue: 'MEDICION', field: 'tipo_etapa' },
    articuloCorreccionId: { type: DataTypes.INTEGER, allowNull: true, field: 'articulo_correccion_id' },
    cantidadCorreccion: { type: DataTypes.DECIMAL(12, 4), allowNull: true, field: 'cantidad_correccion' },
    unidadCorreccionId: { type: DataTypes.INTEGER, allowNull: true, field: 'unidad_correccion_id' },
    observaciones: { type: DataTypes.TEXT, allowNull: true },
    medidoEn: { type: DataTypes.DATE, allowNull: false, field: 'medido_en' },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
  },
  {
    sequelize,
    modelName: 'MezclaEtapa',
    tableName: 'mezcla_etapas',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

export default MezclaEtapa;
