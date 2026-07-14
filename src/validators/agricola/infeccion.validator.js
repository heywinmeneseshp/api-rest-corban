import Joi from 'joi';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();

const hojaSchema = Joi.object({
  numeroHoja: Joi.number().integer().min(1).required(),
  severidad: Joi.number().integer().min(0),
  estadio: Joi.number().integer().min(0),
});

export const getInfeccionSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const createInfeccionSchema = Joi.object({
  body: Joi.object({
    hojasTotales: Joi.number().integer().min(0).required(),
    yli: Joi.number().integer().min(0).required(),
    yls: Joi.number().integer().min(0).required(),
    hojas: Joi.array().items(hojaSchema).default([]),
  }),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const updateInfeccionSchema = Joi.object({
  body: Joi.object({
    hojasTotales: Joi.number().integer().min(0),
    yli: Joi.number().integer().min(0),
    yls: Joi.number().integer().min(0),
    estado: Joi.boolean(),
    hojas: Joi.array().items(hojaSchema),
  }).min(1),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});
