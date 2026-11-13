import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Historial de una parte: ciclos, novedades, mantenimientos y asignaciones a equipos.
export class ParteEquipoRegistro extends Model {}

ParteEquipoRegistro.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    parteId: { type: DataTypes.INTEGER, allowNull: false, field: 'parte_id' },
    // CICLOS | NOVEDAD | MANTENIMIENTO | ASIGNACION
    tipo: { type: DataTypes.STRING(15), allowNull: false },
    fechaHora: { type: DataTypes.DATE, allowNull: false, field: 'fecha_hora' },
    ciclos: { type: DataTypes.DECIMAL(10, 0), allowNull: true },
    descripcion: { type: DataTypes.TEXT, allowNull: true },
    equipoId: { type: DataTypes.INTEGER, allowNull: true, field: 'equipo_id' },
    usuarioId: { type: DataTypes.INTEGER, allowNull: true, field: 'usuario_id' },
  },
  {
    sequelize,
    modelName: 'ParteEquipoRegistro',
    tableName: 'parte_equipo_registros',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

export default ParteEquipoRegistro;
