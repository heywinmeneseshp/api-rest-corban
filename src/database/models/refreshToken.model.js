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
    // Presente solo si este refresh token pertenece a una sesión de
    // suplantación ("Ver como usuario", ver authService.impersonate) — se
    // reenvía a cada renovación (authService.refresh) para que el admin
    // suplantador siga siendo el actor de createdBy/updatedBy aunque la
    // sesión dure más que la vida del access token original.
    impersonatedBy: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'impersonated_by',
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
