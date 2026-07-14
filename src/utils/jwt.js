import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { jwtConfig } from '../config/jwt.config.js';

export const signAccessToken = (payload) =>
  jwt.sign(payload, jwtConfig.accessToken.secret, {
    expiresIn: jwtConfig.accessToken.expiresIn,
  });

export const verifyAccessToken = (token) => jwt.verify(token, jwtConfig.accessToken.secret);

export const generateRefreshToken = () => crypto.randomBytes(64).toString('hex');

export const hashRefreshToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

export const refreshTokenExpiryDate = () => {
  const match = /^(\d+)([smhd])$/.exec(jwtConfig.refreshToken.expiresIn);
  const unitToMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  const ms = match ? Number(match[1]) * unitToMs[match[2]] : 7 * 86_400_000;
  return new Date(Date.now() + ms);
};
