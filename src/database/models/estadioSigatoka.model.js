import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class EstadioSigatoka extends Model {}

EstadioSigatoka.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    estadio: { type: DataTypes.STRING(10), allowNull: false, unique: true },
    // Valor numérico configurable con el que se calcula la Suma Bruta,
    // según de cuál de las tres hojas evaluadas (3, 4 o 5) venga el estadio
    // — el mismo código de estadio pesa distinto en cada hoja.
    valorL3: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 0, field: 'valor_l3' },
    valorL4: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 0, field: 'valor_l4' },
    valorL5: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 0, field: 'valor_l5' },
    orden: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    estado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
    deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
  },
  {
    sequelize,
    modelName: 'EstadioSigatoka',
    tableName: 'estadios_sigatoka',
    underscored: true,
    paranoid: true,
  },
);

export default EstadioSigatoka;
