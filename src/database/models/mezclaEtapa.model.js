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
