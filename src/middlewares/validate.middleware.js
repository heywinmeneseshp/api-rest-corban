import { ApiError } from '../utils/ApiError.js';

export const validate = (schema, part) => (req, _res, next) => {
  // Compatibilidad: inventario FASE 1/2 usan validate(schema, 'query'|'params') con schema plano
  // (sin wrapper body/params/query). Fases recientes usan wrapper Joi.object({ body, params, query }).
  // Este middleware soporta ambos para no romper rutas existentes.
  if (part && ['body', 'params', 'query'].includes(part)) {
    const { error, value } = schema.validate(req[part], {
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: false,
    });
    if (error) {
      const errors = error.details.map((d) => ({
        field: d.path.join('.') || part,
        message: d.message,
      }));
      return next(ApiError.badRequest('Error de validación', errors));
    }
    req[part] = value;
    return next();
  }

  // Detecta si el schema es "wrapped" (tiene keys body/params/query) o plano (body-only legacy)
  let isWrapped = false;
  try {
    const desc = schema.describe();
    const keys = desc.keys ? Object.keys(desc.keys) : [];
    isWrapped = keys.includes('body') || keys.includes('params') || keys.includes('query');
  } catch {
    isWrapped = false;
  }

  if (!isWrapped) {
    // Schema plano legacy -> validar solo body
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: false,
    });
    if (error) {
      const errors = error.details.map((d) => ({
        field: d.path.join('.') || 'body',
        message: d.message,
      }));
      return next(ApiError.badRequest('Error de validación', errors));
    }
    req.body = value;
    return next();
  }

  const toValidate = {
    body: req.body,
    params: req.params,
    query: req.query,
  };

  const { error, value } = schema.validate(toValidate, {
    abortEarly: false,
    stripUnknown: true,
    allowUnknown: false,
  });

  if (error) {
    const errors = error.details.map((d) => {
      const field = d.path.slice(1).join('.') || d.path.join('.');
      return { field, message: d.message.replaceAll(`"${d.path.join('.')}"`, `"${field}"`) };
    });
    return next(ApiError.badRequest('Error de validación', errors));
  }

  req.body = value.body;
  req.params = value.params;
  req.query = value.query;
  next();
};

export default validate;
