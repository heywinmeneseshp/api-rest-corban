import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class ComprobanteAspersion extends Model {}

ComprobanteAspersion.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    numero: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    // Una aspersión puede tener varios comprobantes: uno vigente (BORRADOR o
    // EMITIDO) y los anulados. La regla de "un solo vigente" la valida el
    // servicio (ver comprobanteAspersion.service.js#anular/regenerar).
    aspersionProgramacionId: { type: DataTypes.INTEGER, allowNull: false, field: 'aspersion_programacion_id' },
    estado: { type: DataTypes.ENUM('BORRADOR', 'EMITIDO', 'ANULADO'), allowNull: false, defaultValue: 'BORRADOR' },
    medio: { type: DataTypes.ENUM('AVION', 'DRON'), allowNull: true },
    piloto: { type: DataTypes.STRING(150), allowNull: true },
    hectareasProgramadas: { type: DataTypes.DECIMAL(10, 2), allowNull: false, field: 'hectareas_programadas' },
    hectareasAplicadas: { type: DataTypes.DECIMAL(10, 2), allowNull: true, field: 'hectareas_aplicadas' },
    galonesTotales: { type: DataTypes.DECIMAL(12, 2), allowNull: true, field: 'galones_totales' },
    observaciones: { type: DataTypes.TEXT, allowNull: true },
    // Datos de la aplicación (hoja del comprobante): aeronave usada, volumen de
    // aplicación por hectárea (galones/ha), condiciones climáticas y horario.
    aeronave: { type: DataTypes.STRING(150), allowNull: true },
    volumenAplicacionHa: { type: DataTypes.DECIMAL(10, 2), allowNull: true, field: 'volumen_aplicacion_ha' },
    temperaturaInicial: { type: DataTypes.DECIMAL(5, 1), allowNull: true, field: 'temperatura_inicial' },
    temperaturaFinal: { type: DataTypes.DECIMAL(5, 1), allowNull: true, field: 'temperatura_final' },
    velocidadViento: { type: DataTypes.DECIMAL(6, 1), allowNull: true, field: 'velocidad_viento' },
    humedadRelativaFinal: { type: DataTypes.DECIMAL(5, 1), allowNull: true, field: 'humedad_relativa_final' },
    horaInicio: { type: DataTypes.STRING(5), allowNull: true, field: 'hora_inicio' },
    horaFinal: { type: DataTypes.STRING(5), allowNull: true, field: 'hora_final' },
    ejecutadoPorId: { type: DataTypes.INTEGER, allowNull: true, field: 'ejecutado_por_id' },
    ejecutadoEn: { type: DataTypes.DATE, allowNull: true, field: 'ejecutado_en' },
    emitidoPorId: { type: DataTypes.INTEGER, allowNull: true, field: 'emitido_por_id' },
    emitidoEn: { type: DataTypes.DATE, allowNull: true, field: 'emitido_en' },
    // Con dron: el piloto es un colaborador (cargo «Piloto de Dron»); `piloto` guarda la copia de su nombre.
    pilotoColaboradorId: { type: DataTypes.INTEGER, allowNull: true, field: 'piloto_colaborador_id' },
    // Recorrido de la aplicación (KML): el archivo original y su geometría simplificada para el mapa del PDF.
    kml: { type: DataTypes.TEXT('medium'), allowNull: true },
    kmlNombre: { type: DataTypes.STRING(200), allowNull: true, field: 'kml_nombre' },
    kmlGeometria: { type: DataTypes.JSON, allowNull: true, field: 'kml_geometria' },
    kmlSubidoEn: { type: DataTypes.DATE, allowNull: true, field: 'kml_subido_en' },
    // Envío por correo (después de emitir): PDF con el mapa y el KMZ del recorrido.
    correoEnviadoEn: { type: DataTypes.DATE, allowNull: true, field: 'correo_enviado_en' },
    correoEnviadoPorId: { type: DataTypes.INTEGER, allowNull: true, field: 'correo_enviado_por_id' },
    // Anulación (reemplaza el borrado): el comprobante anulado queda como
    // registro histórico y desde él se puede regenerar un borrador nuevo.
    motivoAnulacion: { type: DataTypes.TEXT, allowNull: true, field: 'motivo_anulacion' },
    anuladoPorId: { type: DataTypes.INTEGER, allowNull: true, field: 'anulado_por_id' },
    anuladoEn: { type: DataTypes.DATE, allowNull: true, field: 'anulado_en' },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'ComprobanteAspersion',
    tableName: 'comprobantes_aspersion',
    underscored: true,
    paranoid: true,
  },
);

export default ComprobanteAspersion;
