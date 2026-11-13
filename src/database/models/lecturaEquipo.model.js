import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Lectura de kilometraje y/o horómetro de un equipo, registrada por quien lo opera (web o app móvil).
export class LecturaEquipo extends Model {}

LecturaEquipo.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    equipoId: { type: DataTypes.INTEGER, allowNull: false, field: 'equipo_id' },
    fechaHora: { type: DataTypes.DATE, allowNull: false, field: 'fecha_hora' },
    kilometraje: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
    horometro: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
    usuarioId: { type: DataTypes.INTEGER, allowNull: true, field: 'usuario_id' },
    origen: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'WEB' },
    nota: { type: DataTypes.STRING(300), allowNull: true },
  },
  {
    sequelize,
    modelName: 'LecturaEquipo',
    tableName: 'lecturas_equipo',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

export default LecturaEquipo;
