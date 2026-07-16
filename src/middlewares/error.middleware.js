import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.config.js';

const mapSequelizeError = (err) => {
  switch (err.name) {
    case 'SequelizeValidationError':
      return ApiError.badRequest(
        'Error de validación',
        err.errors.map((e) => ({ field: e.path, message: e.message })),
      );
    case 'SequelizeUniqueConstraintError':
      return ApiError.conflict(
        'Ya existe un registro con esos datos',
        err.errors.map((e) => ({ field: e.path, message: e.message })),
      );
    case 'SequelizeForeignKeyConstraintError':
      return ApiError.badRequest('Referencia inválida a un recurso relacionado');
    case 'SequelizeDatabaseError':
      return ApiError.internal('Error al procesar la operación en la base de datos');
    default:
      return null;
  }
};

export const errorHandler = (err, req, res, _next) => {
  let apiError = err instanceof ApiError ? err : mapSequelizeError(err);

  if (!apiError && err.name === 'MulterError') {
    apiError = ApiError.badRequest(
      err.code === 'LIMIT_FILE_SIZE' ? 'El archivo supera el tamaño máximo permitido (10MB)' : err.message,
    );
  }

  if (!apiError && err.statusCode) {
    apiError = ApiError.badRequest(err.message);
  }

  if (!apiError) {
    apiError = ApiError.internal(env.isProduction ? 'Error interno del servidor' : err.message);
  }

  const logPayload = {
    method: req.method,
    path: req.originalUrl,
    userId: req.user?.id,
    statusCode: apiError.statusCode,
  };

  if (apiError.statusCode >= 500) {
    logger.error(err.message, { ...logPayload, stack: err.stack });
  } else {
    logger.warn(apiError.message, logPayload);
  }

  res.status(apiError.statusCode).json({
    success: false,
    message: apiError.message,
    errors: apiError.errors || [],
  });
};

export default errorHandler;
