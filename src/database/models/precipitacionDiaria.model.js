import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Registro día a día de precipitación diaria por finca, capturado desde
// app-corbana. Tabla creada originalmente con SQL crudo (ver
// precipitacionDiaria.service.js) — este modelo formaliza las relaciones
// reales (finca_id/usuario_id) que ya tenía como columnas sueltas, ver
// migración 20260821000003-fk-precipitacion-diaria.
export class PrecipitacionDiaria extends Model {}

PrecipitacionDiaria.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    fincaId: { type: DataTypes.INTEGER, allowNull: false, field: 'finca_id' },
    fincaUuid: { type: DataTypes.UUID, allowNull: false, field: 'finca_uuid' },
    // finca_nombre/usuario_nombre: copiados al registrar — se mantienen por
    // compatibilidad (registros sin usuario_id, de antes de que existiera
    // esta columna), pero las lecturas nuevas prefieren el dato vivo de la
    // asociación cuando usuario_id existe.
    fincaNombre: { type: DataTypes.STRING(255), allowNull: true, field: 'finca_nombre' },
    fecha: { type: DataTypes.DATEONLY, allowNull: false },
    mm: { type: DataTypes.DECIMAL(8, 2), allowNull: false },
    usuarioId: { type: DataTypes.INTEGER, allowNull: true, field: 'usuario_id' },
    usuarioNombre: { type: DataTypes.STRING(255), allowNull: true, field: 'usuario_nombre' },
    coincideClima: { type: DataTypes.BOOLEAN, allowNull: true, field: 'coincide_clima' },
  },
  {
    sequelize,
    modelName: 'PrecipitacionDiaria',
    tableName: 'precipitacion_diaria',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  },
);

export default PrecipitacionDiaria;
