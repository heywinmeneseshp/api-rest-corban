import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class LoteAreaConfig extends Model {}

LoteAreaConfig.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    fincaId: { type: DataTypes.INTEGER, allowNull: false, field: 'finca_id' },
    rolId: { type: DataTypes.INTEGER, allowNull: false, field: 'rol_id' },
    // Fecha puntual (no un rango): antes de esta fecha la config no exige
    // nada; desde que llega, cada lote de la finca queda obligado a tener un
    // LoteAreaProduccion con fechaRegistro >= fechaObjetivo y areaTotal
    // definida, sin importar cuántos días pasen sin registrarlo. Con
    // recurrencia distinta de UNA_VEZ, al completarse la campaña esta fecha
    // avanza sola (y con UNA_VEZ la config se desactiva sola).
    fechaObjetivo: { type: DataTypes.DATEONLY, allowNull: false, field: 'fecha_objetivo' },
    // Cada cuánto se vuelve a pedir el dato una vez cumplida la campaña
    // (SEMANAL = 7 días, QUINCENAL = 15, MENSUAL = 30).
    recurrencia: {
      type: DataTypes.ENUM('UNA_VEZ', 'SEMANAL', 'QUINCENAL', 'MENSUAL'),
      allowNull: false,
      defaultValue: 'UNA_VEZ',
    },
    activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  { sequelize, modelName: 'LoteAreaConfig', tableName: 'lote_area_config', underscored: true, paranoid: true },
);

export default LoteAreaConfig;
