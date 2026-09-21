import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class AspersionProgramacion extends Model {}

AspersionProgramacion.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    numero: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    fincaId: { type: DataTypes.INTEGER, allowNull: false, field: 'finca_id' },
    fecha: { type: DataTypes.DATEONLY, allowNull: false },
    semanaId: { type: DataTypes.INTEGER, allowNull: true, field: 'semana_id' },
    // Array de uno o más de 'SIGATOKA_NEGRA' | 'DEFOLIADOR' | 'FERTILIZACION'
    // — el aviso en papel permite marcar varias casillas a la vez (pedido
    // explícito: "se puede seleccionar más de una").
    tipo: { type: DataTypes.JSON, allowNull: false, defaultValue: ['SIGATOKA_NEGRA'] },
    // Con qué se hace la aspersión — selección única (Avión o Dron), nunca
    // las dos a la vez.
    medio: { type: DataTypes.ENUM('AVION', 'DRON'), allowNull: true },
    mezclaId: { type: DataTypes.INTEGER, allowNull: false, field: 'mezcla_id' },
    almacenId: { type: DataTypes.INTEGER, allowNull: false, field: 'almacen_id' },
    hectareas: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    cantidadCalculada: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: 'cantidad_calculada' },
    estado: {
      type: DataTypes.ENUM('PROGRAMADA', 'EJECUTADA', 'CANCELADA'),
      allowNull: false,
      defaultValue: 'PROGRAMADA',
    },
    fechaEjecucion: { type: DataTypes.DATEONLY, allowNull: true, field: 'fecha_ejecucion' },
    movimientoDocumento: { type: DataTypes.STRING(50), allowNull: true, unique: true, field: 'movimiento_documento' },
    representanteCorbanaNombre: { type: DataTypes.STRING(150), allowNull: true, field: 'representante_corbana_nombre' },
    administradorFincaNombre: { type: DataTypes.STRING(150), allowNull: true, field: 'administrador_finca_nombre' },
    observaciones: { type: DataTypes.TEXT, allowNull: true },
    // Última vez que se envió el aviso por correo (ver
    // aspersionProgramacion.service.js#enviarCorreo) — el frontend lo usa
    // para pintar el ícono de correo en verde y para ocultar "Eliminar"
    // una vez que el aviso ya salió a la finca.
    correoEnviadoEn: { type: DataTypes.DATE, allowNull: true, field: 'correo_enviado_en' },
    usuarioId: { type: DataTypes.INTEGER, allowNull: true, field: 'usuario_id' },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'AspersionProgramacion',
    tableName: 'aspersion_programaciones',
    underscored: true,
    paranoid: true,
  },
);

export default AspersionProgramacion;
