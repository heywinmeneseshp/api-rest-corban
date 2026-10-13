import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Una muestra (pose) de la huella facial de un colaborador: 128 números calculados en el dispositivo. No es una foto.
export class ColaboradorRostro extends Model {}

ColaboradorRostro.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    colaboradorId: { type: DataTypes.INTEGER, allowNull: false, field: 'colaborador_id' },
    pose: { type: DataTypes.STRING(20), allowNull: true },
    descriptor: { type: DataTypes.JSON, allowNull: false },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
  },
  {
    sequelize,
    modelName: 'ColaboradorRostro',
    tableName: 'colaborador_rostros',
    underscored: true,
    paranoid: true,
  },
);

export default ColaboradorRostro;
