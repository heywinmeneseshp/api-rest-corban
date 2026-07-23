import Joi from 'joi';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();

export const listMotivosRecuseSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    search: Joi.string().allow('').max(150),
  }),
});

export const getMotivoRecuseSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const createMotivoRecuseSchema = Joi.object({
  body: Joi.object({
    nombre: Joi.string().min(2).max(100).required(),
    descripcion: Joi.string().max(255).allow('', null),
    codigoExterno: Joi.string().max(50).allow('', null),
    estado: Joi.boolean(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const updateMotivoRecuseSchema = Joi.object({
  body: Joi.object({
    nombre: Joi.string().min(2).max(100),
    descripcion: Joi.string().max(255).allow('', null),
    codigoExterno: Joi.string().max(50).allow('', null),
    estado: Joi.boolean(),
  }).min(1),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});
