import { RefreshToken } from '../../database/associations.js';

export const authRepository = {
  createRefreshToken({ userId, tokenHash, expiresAt, impersonatedBy }, { transaction } = {}) {
    return RefreshToken.create({ userId, tokenHash, expiresAt, impersonatedBy: impersonatedBy || null }, { transaction });
  },

  findByTokenHash(tokenHash) {
    return RefreshToken.findOne({ where: { tokenHash } });
  },

  revoke(refreshToken, { transaction } = {}) {
    return refreshToken.update({ revokedAt: new Date() }, { transaction });
  },

  revokeAllForUser(userId, { transaction } = {}) {
    return RefreshToken.update(
      { revokedAt: new Date() },
      { where: { userId, revokedAt: null }, transaction },
    );
  },
};

export default authRepository;
