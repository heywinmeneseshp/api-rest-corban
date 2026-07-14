import Joi from 'joi';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();

export const listFincasSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    search: Joi.string().allow('').max(150),
  }),
});

export const getFincaSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const listFincaLotesSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
  }),
});

export const createFincaSchema = Joi.object({
  body: Joi.object({
    codigo: Joi.string().min(1).max(20).required(),
    nombre: Joi.string().min(2).max(150).required(),
    estado: Joi.boolean(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const updateFincaSchema = Joi.object({
  body: Joi.object({
    codigo: Joi.string().min(1).max(20),
    nombre: Joi.string().min(2).max(150),
    estado: Joi.boolean(),
  }).min(1),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});
