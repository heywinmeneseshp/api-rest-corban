import Joi from 'joi';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();

// "0" es sin estadio (lo que la app móvil envía como cadena vacía).
const estadioPattern = Joi.string()
  .pattern(/^(0|[1-6][+-])$/)
  .message('El estadio debe tener el formato "0" o "1-", "1+", "2-", …, "6+", "6-"');

export const listEstadiosSigatokaSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    search: Joi.string().allow('').max(10),
  }),
});

export const getEstadioSigatokaSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const createEstadioSigatokaSchema = Joi.object({
  body: Joi.object({
    estadio: estadioPattern.required(),
    valorL3: Joi.number().min(0),
    valorL4: Joi.number().min(0),
    valorL5: Joi.number().min(0),
    orden: Joi.number().integer().min(0),
    estado: Joi.boolean(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const updateEstadioSigatokaSchema = Joi.object({
  body: Joi.object({
    estadio: estadioPattern,
    valorL3: Joi.number().min(0),
    valorL4: Joi.number().min(0),
    valorL5: Joi.number().min(0),
    orden: Joi.number().integer().min(0),
    estado: Joi.boolean(),
  }).min(1),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});
