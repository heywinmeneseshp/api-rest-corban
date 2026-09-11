import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class MezclaVersion extends Model {}

MezclaVersion.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    mezclaId: { type: DataTypes.INTEGER, allowNull: false, field: 'mezcla_id' },
    version: { type: DataTypes.INTEGER, allowNull: false },
    activa: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    costoTotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: 'costo_total' },
    costoUnitario: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: 'costo_unitario' },
    // Ciclo de vida de la PRUEBA DE LABORATORIO (ver mezcla.service.js):
    // BORRADOR (recién creada) → EN_PRUEBA (con al menos una etapa
    // registrada) → OPTIMA/NO_VALIDA (al finalizar) → CONVERTIDA (cuando
    // ya generó un Elaboracion). Independiente del campo `activa` de
    // arriba, que sigue siendo "es la versión vigente de esta mezcla".
    estadoPrueba: {
      type: DataTypes.ENUM('BORRADOR', 'EN_PRUEBA', 'OPTIMA', 'NO_VALIDA', 'PENDIENTE_APROBACION', 'CONVERTIDA'),
      allowNull: false,
      defaultValue: 'BORRADOR',
      field: 'estado_prueba',
    },
    // Fecha/hora y usuario que finalizó la prueba (OPTIMA/NO_VALIDA) y que
    // la aprobó (paso de PENDIENTE_APROBACION a CONVERTIDA).
    finalizadaEn: { type: DataTypes.DATE, allowNull: true, field: 'finalizada_en' },
    finalizadaPorId: { type: DataTypes.INTEGER, allowNull: true, field: 'finalizada_por' },
    aprobadaEn: { type: DataTypes.DATE, allowNull: true, field: 'aprobada_en' },
    aprobadaPorId: { type: DataTypes.INTEGER, allowNull: true, field: 'aprobada_por' },
    // Datos de "Crear elaborado" en espera de aprobación (la Elaboración y
    // su entrada de inventario recién se generan al aprobar).
    elaboradoPayload: { type: DataTypes.JSON, allowNull: true, field: 'elaborado_payload' },
    phFinal: { type: DataTypes.DECIMAL(4, 2), allowNull: true, field: 'ph_final' },
    ceFinal: { type: DataTypes.DECIMAL(6, 2), allowNull: true, field: 'ce_final' },
    // Snapshot de CLAVE_MEZCLA_PARAMETROS al finalizar — para que un
    // cambio posterior en Configuración no altere el resultado histórico.
    parametrosUsados: { type: DataTypes.JSON, allowNull: true, field: 'parametros_usados' },
    // Documento del movimiento de salida de inventario generado al
    // finalizar (MIX-0001) — único, es la guardia contra doble descuento.
    movimientoDocumento: { type: DataTypes.STRING(50), allowNull: true, unique: true, field: 'movimiento_documento' },
    almacenId: { type: DataTypes.INTEGER, allowNull: true, field: 'almacen_id' },
    elaboracionId: { type: DataTypes.INTEGER, allowNull: true, field: 'elaboracion_id' },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
  },
  {
    sequelize,
    modelName: 'MezclaVersion',
    tableName: 'mezcla_versiones',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

export default MezclaVersion;
