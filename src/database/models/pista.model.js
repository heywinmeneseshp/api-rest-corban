import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Pista de aviación desde donde sale la aspersión aérea. `correos`: lista de correos que reciben el aviso de aspersión de la pista.
export class Pista extends Model {}

Pista.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    nombre: { type: DataTypes.STRING(120), allowNull: false },
    // Responsable / representante de la pista (firma el aviso de la pista) y su teléfono.
    responsable: { type: DataTypes.STRING(150), allowNull: true },
    telefono: { type: DataTypes.STRING(40), allowNull: true },
    correos: { type: DataTypes.JSON, allowNull: true },
    observaciones: { type: DataTypes.STRING(300), allowNull: true },
    estado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'Pista',
    tableName: 'pistas',
    underscored: true,
    paranoid: true,
  },
);

export default Pista;
