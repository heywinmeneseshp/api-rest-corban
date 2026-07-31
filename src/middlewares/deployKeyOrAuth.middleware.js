import { auth } from './auth.middleware.js';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.config.js';

// Para endpoints que un script de deploy debe poder llamar sin credenciales
// de una persona real: si viene X-Deploy-Key y coincide, pasa directo (sin
// req.user). Si no viene o no coincide, cae al login normal — así el panel
// admin (usuario logueado) sigue funcionando igual que antes.
export const deployKeyOrAuth = (req, res, next) => {
  const key = req.header('X-Deploy-Key');
  if (env.appVersionDeployKey && key === env.appVersionDeployKey) {
    return next();
  }
  if (key) {
    return next(ApiError.unauthorized('Deploy key inválida'));
  }
  return auth(req, res, next);
};

export default deployKeyOrAuth;
