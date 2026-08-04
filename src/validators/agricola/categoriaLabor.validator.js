import Joi from 'joi';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();

export const listCategoriasLaborSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    search: Joi.string().allow('').max(150),
  }),
});

export const getCategoriaLaborSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const createCategoriaLaborSchema = Joi.object({
  body: Joi.object({
    nombre: Joi.string().min(2).max(100).required(),
    orden: Joi.number().integer().min(0),
    estado: Joi.boolean(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const updateCategoriaLaborSchema = Joi.object({
  body: Joi.object({
    nombre: Joi.string().min(2).max(100),
    orden: Joi.number().integer().min(0),
    estado: Joi.boolean(),
  }).min(1),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});
