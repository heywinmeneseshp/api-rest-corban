import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Evidencia fotográfica de una prueba de mezcla — mismo patrón de Google
// Drive que labor_visita_fotos (ver services/googleDrive/cargueFotosLabor.js),
// pero como modelo Sequelize propio (Mezclas ya usa Sequelize/migraciones,
// a diferencia de labores_culturales que es una tabla legacy de SQL crudo).
// El binario nunca se guarda acá — solo la referencia al archivo en Drive.
export class MezclaFoto extends Model {}

MezclaFoto.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    mezclaVersionId: { type: DataTypes.INTEGER, allowNull: false, field: 'mezcla_version_id' },
    // Nullable: hoy la foto se asocia a la prueba completa; queda listo
    // para asociarla a una etapa puntual sin migrar nada más.
    mezclaEtapaId: { type: DataTypes.INTEGER, allowNull: true, field: 'mezcla_etapa_id' },
    idDrive: { type: DataTypes.STRING(100), allowNull: false, field: 'id_drive' },
    urlDrive: { type: DataTypes.STRING(500), allowNull: true, field: 'url_drive' },
    nombreOriginal: { type: DataTypes.STRING(255), allowNull: true, field: 'nombre_original' },
    nombreDrive: { type: DataTypes.STRING(255), allowNull: true, field: 'nombre_drive' },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
  },
  {
    sequelize,
    modelName: 'MezclaFoto',
    tableName: 'mezcla_fotos',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  },
);

export default MezclaFoto;
