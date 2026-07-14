import { env } from './env.config.js';

export const jwtConfig = {
  accessToken: {
    secret: env.jwt.secret,
    expiresIn: env.jwt.expiresIn,
  },
  refreshToken: {
    secret: env.jwt.refreshSecret,
    expiresIn: env.jwt.refreshExpiresIn,
  },
};
