import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class ProgramacionCorte extends Model {}

ProgramacionCorte.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    fecha: { type: DataTypes.DATEONLY, allowNull: false },
    fincaId: { type: DataTypes.INTEGER, allowNull: false, field: 'finca_id' },
    semanaId: { type: DataTypes.INTEGER, allowNull: false, field: 'semana_id' },
    // Producto/fruta cortada (mismo concepto que "combo" en Logística) —
    // catálogo propio en `productos`, no texto libre.
    productoId: { type: DataTypes.INTEGER, allowNull: true, field: 'producto_id' },
    // Proceso de empaque en Logística (Finca / Local / Puerto, etc.) — una
    // misma fecha+finca+producto puede tener varias filas, una por proceso;
    // '' para el cargue manual, que no conoce este dato. Ver
    // programacionCorte.service.js#agruparYSumarCajas.
    procesoEmpaque: { type: DataTypes.STRING(50), allowNull: false, defaultValue: '', field: 'proceso_empaque' },
    cajasProgramadas: { type: DataTypes.INTEGER, allowNull: false, field: 'cajas_programadas' },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'ProgramacionCorte',
    tableName: 'programacion_corte',
    underscored: true,
    paranoid: true,
    indexes: [{ unique: true, fields: ['fecha', 'finca_id', 'producto_id', 'proceso_empaque'] }],
  },
);

export default ProgramacionCorte;
