import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Estimaciones de cajas por finca y semana. Cada finca estima cuántas cajas
// (de 20kg equivalentes, usando la tasa de conversión configurada) producirá
// en cada una de las próximas semanas. Un usuario solo ingresa/ve las
// estimaciones de las fincas que tiene habilitadas y las suyas propias (ver
// estimacionFincaService).
export class EstimacionFinca extends Model {}

EstimacionFinca.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    semanaId: { type: DataTypes.INTEGER, allowNull: false, field: 'semana_id' },
    fincaId: { type: DataTypes.INTEGER, allowNull: false, field: 'finca_id' },
    // Semana en la que se registró la estimación (columna "Semana registro" del
    // Excel ancho). Permite histórico: misma finca+semana objetivo puede tener
    // varias filas si se estimó en semanas de registro distintas (escalera).
    semanaRegistroId: { type: DataTypes.INTEGER, allowNull: false, field: 'semana_registro_id' },
    // Cajas estimadas (unidad "caja de 20kg" equivalente según la tasa de
    // conversión configurada, igual que Producción Semanal).
    cajas20kg: { type: DataTypes.DECIMAL(10, 2), allowNull: false, field: 'cajas_20kg' },
    // Nota puntual del operador para esta finca+semana — ej. "afectada por
    // lluvias", "atraso de corte". Opcional, no afecta el cálculo.
    observaciones: { type: DataTypes.TEXT, allowNull: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'EstimacionFinca',
    tableName: 'estimaciones_finca',
    underscored: true,
    paranoid: true,
    indexes: [
      // Única por finca+semana+semana de registro — SIN created_by (pedido
      // explícito: si dos usuarios distintos guardan la misma finca+semana
      // en la misma semana de registro, el segundo debe REEMPLAZAR al
      // primero, no convivir como fila aparte. Antes sí incluía
      // created_by, lo que hacía que las vistas agregadas (pivote,
      // escalera, comparativo — todas SUMan por finca+semana sin filtrar
      // por usuario) terminaran sumando las estimaciones de ambos usuarios
      // en vez de quedarse con la más reciente. Ver migración
      // 20261103000000 para la limpieza de duplicados previos a este
      // cambio.
      { unique: true, fields: ['semana_id', 'finca_id', 'semana_registro_id'] },
    ],
  },
);

export default EstimacionFinca;
