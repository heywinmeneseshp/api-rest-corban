import Joi from 'joi';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();
const codigoRule = Joi.string()
  .pattern(/^[a-z_]+\.[a-z_]+$/)
  .max(100)
  .message('El código debe tener el formato "recurso.accion" en minúsculas');

export const listPermisosSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    search: Joi.string().allow('').max(150),
  }),
});

export const getPermisoSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const createPermisoSchema = Joi.object({
  body: Joi.object({
    codigo: codigoRule.required(),
    nombre: Joi.string().min(2).max(150).required(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const updatePermisoSchema = Joi.object({
  body: Joi.object({
    codigo: codigoRule,
    nombre: Joi.string().min(2).max(150),
  }).min(1),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});
