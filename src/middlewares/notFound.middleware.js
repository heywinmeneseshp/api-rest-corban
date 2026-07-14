import { ApiError } from '../utils/ApiError.js';

export const notFound = (req, _res, next) => {
  next(ApiError.notFound(`Ruta no encontrada: ${req.method} ${req.originalUrl}`));
};

export default notFound;
