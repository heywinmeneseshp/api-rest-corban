import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Prueba de homogeneidad de la mezcla — a los 15 min, 30 min y 1 hora de
// mezclada se toma una foto y se confirma si sigue homogénea (no se
// separó). Una fila por punto de control (ver migración
// create-mezcla-homogeneidad), creada/actualizada cuando el operador la
// registra desde la prueba.
export class MezclaHomogeneidad extends Model {}

MezclaHomogeneidad.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    mezclaVersionId: { type: DataTypes.INTEGER, allowNull: false, field: 'mezcla_version_id' },
    intervalo: { type: DataTypes.ENUM('15MIN', '30MIN', '60MIN'), allowNull: false },
    homogenea: { type: DataTypes.BOOLEAN, allowNull: false },
    observaciones: { type: DataTypes.TEXT, allowNull: true },
    medidoEn: { type: DataTypes.DATE, allowNull: false, field: 'medido_en' },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
  },
  {
    sequelize,
    modelName: 'MezclaHomogeneidad',
    tableName: 'mezcla_homogeneidades',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

export default MezclaHomogeneidad;
