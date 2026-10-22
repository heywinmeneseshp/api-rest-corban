import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Conteo (toma de inventario físico) de un almacén. BORRADOR mientras se cuenta; al CERRAR genera los ajustes en el kárdex.
export class ConteoInventario extends Model {}

ConteoInventario.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    almacenId: { type: DataTypes.INTEGER, allowNull: false, field: 'almacen_id' },
    categoriaId: { type: DataTypes.INTEGER, allowNull: true, field: 'categoria_id' },
    fecha: { type: DataTypes.DATEONLY, allowNull: false },
    estado: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'BORRADOR' },
    ciego: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    observaciones: { type: DataTypes.TEXT, allowNull: true },
    motivoId: { type: DataTypes.INTEGER, allowNull: true, field: 'motivo_id' },
    cerradoAt: { type: DataTypes.DATE, allowNull: true, field: 'cerrado_at' },
    cerradoBy: { type: DataTypes.INTEGER, allowNull: true, field: 'cerrado_by' },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  { sequelize, modelName: 'ConteoInventario', tableName: 'conteos_inventario', underscored: true, paranoid: true },
);

export default ConteoInventario;
