import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

// Manipuladores de plaguicidas: tabla propia (no son colaboradores). Se eligen en el comprobante de aspersión.
export class ManipuladorPlaguicida extends Model {}

ManipuladorPlaguicida.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    nombre: { type: DataTypes.STRING(150), allowNull: false },
    documento: { type: DataTypes.STRING(30), allowNull: true },
    estado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
  },
  {
    sequelize,
    modelName: 'ManipuladorPlaguicida',
    tableName: 'manipuladores_plaguicidas',
    underscored: true,
  },
);

export default ManipuladorPlaguicida;
