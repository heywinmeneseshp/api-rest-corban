import Joi from 'joi';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();

const estadioSchema = Joi.object({
  numeroHoja: Joi.number().integer().min(1).required(),
  estadio: Joi.string().max(20).required(),
});

export const getSumaBrutaSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const createSumaBrutaSchema = Joi.object({
  body: Joi.object({
    hojasFuncionales: Joi.number().integer().min(0).required(),
    candela: Joi.number().min(0).precision(2),
    estadios: Joi.array().items(estadioSchema).default([]),
  }),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const updateSumaBrutaSchema = Joi.object({
  body: Joi.object({
    hojasFuncionales: Joi.number().integer().min(0),
    candela: Joi.number().min(0).precision(2),
    estado: Joi.boolean(),
    estadios: Joi.array().items(estadioSchema),
  }).min(1),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});
