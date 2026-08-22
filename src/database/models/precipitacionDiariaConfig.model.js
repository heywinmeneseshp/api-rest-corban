import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Qué rol debe capturar la precipitación diaria de qué finca, a partir de
// qué semana (programado por un admin). Tabla creada originalmente con SQL
// crudo (ver precipitacionDiaria.service.js) — este modelo formaliza las
// relaciones reales (finca_id/rol_id/semana_inicio_uuid) que ya tenía como
// columnas sueltas, ver migración 20260821000003-fk-precipitacion-diaria.
export class PrecipitacionDiariaConfig extends Model {}

PrecipitacionDiariaConfig.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    fincaId: { type: DataTypes.INTEGER, allowNull: false, field: 'finca_id' },
    // finca_uuid/finca_nombre/rol_nombre/semana_inicio_codigo: copiados al
    // crear, para no depender de un JOIN en cada lectura — se mantienen por
    // compatibilidad, pero las lecturas nuevas prefieren el dato vivo de la
    // asociación (ver precipitacionDiaria.service.js#listConfig).
    fincaUuid: { type: DataTypes.UUID, allowNull: false, field: 'finca_uuid' },
    fincaNombre: { type: DataTypes.STRING(255), allowNull: true, field: 'finca_nombre' },
    rolId: { type: DataTypes.INTEGER, allowNull: false, field: 'rol_id' },
    rolNombre: { type: DataTypes.STRING(100), allowNull: true, field: 'rol_nombre' },
    semanaInicioUuid: { type: DataTypes.UUID, allowNull: false, field: 'semana_inicio_uuid' },
    semanaInicioCodigo: { type: DataTypes.STRING(20), allowNull: true, field: 'semana_inicio_codigo' },
    fechaInicio: { type: DataTypes.DATEONLY, allowNull: false, field: 'fecha_inicio' },
    activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    creadoPorNombre: { type: DataTypes.STRING(255), allowNull: true, field: 'creado_por_nombre' },
  },
  {
    sequelize,
    modelName: 'PrecipitacionDiariaConfig',
    tableName: 'precipitacion_diaria_config',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  },
);

export default PrecipitacionDiariaConfig;
