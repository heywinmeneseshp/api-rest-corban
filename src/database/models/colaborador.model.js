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
    // Cargo del maestro (Maestros → Cargos); `cargo` guarda la copia de su nombre.
    cargoId: { type: DataTypes.INTEGER, allowNull: true, field: 'cargo_id' },
    telefono: { type: DataTypes.STRING(30), allowNull: true },
    // Lugar predeterminado: una finca o un lugar de asistencia (oficina...), nunca ambos. Solo es el habitual: puede marcar en otro.
    fincaId: { type: DataTypes.INTEGER, allowNull: true, field: 'finca_id' },
    lugarId: { type: DataTypes.INTEGER, allowNull: true, field: 'lugar_id' },
    estado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    // GENERAL (Maestros → Colaboradores) o SANIDAD_VEGETAL (creado desde Sanidad Vegetal → Colaboradores).
    modulo: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'GENERAL' },
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
