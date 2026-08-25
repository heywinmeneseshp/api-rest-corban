import { ApiError } from '../utils/ApiError.js';

export const validate = (schema) => (req, _res, next) => {
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
