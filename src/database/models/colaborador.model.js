import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class Colaborador extends Model {}

Colaborador.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    nombre: { type: DataTypes.STRING(150), allowNull: false },
    apellido: { type: DataTypes.STRING(150), allowNull: true },
    documento: { type: DataTypes.STRING(30), allowNull: true },
    email: { type: DataTypes.STRING(150), allowNull: true },
    cargo: { type: DataTypes.STRING(100), allowNull: true },
    telefono: { type: DataTypes.STRING(30), allowNull: true },
    fincaId: { type: DataTypes.INTEGER, allowNull: true, field: 'finca_id' },
    estado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    // Autorización del tratamiento del dato biométrico (huella facial) y usuario vinculado (marca en su propio celular).
    rostroConsentimientoAt: { type: DataTypes.DATE, allowNull: true, field: 'rostro_consentimiento_at' },
    userId: { type: DataTypes.INTEGER, allowNull: true, unique: true, field: 'user_id' },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'Colaborador',
    tableName: 'colaboradores',
    underscored: true,
    paranoid: true,
  },
);

export default Colaborador;
