import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../connection.js';

export class RefreshToken extends Model {}

RefreshToken.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
    },
    tokenHash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
      field: 'token_hash',
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'expires_at',
    },
    revokedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'revoked_at',
    },
  },
  {
    sequelize,
    modelName: 'RefreshToken',
    tableName: 'refresh_tokens',
    underscored: true,
    timestamps: true,
    paranoid: false,
  },
);

export default RefreshToken;
