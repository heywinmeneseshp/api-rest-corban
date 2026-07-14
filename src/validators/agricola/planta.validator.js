import Joi from 'joi';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();
const uuidRef = Joi.string().guid({ version: 'uuidv4' });
const coordRule = Joi.number().min(-180).max(180);

export const listPlantasSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    search: Joi.string().allow('').max(150),
  }),
});

export const getPlantaSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const listPlantaEvaluacionesSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
  }),
});

export const createPlantaSchema = Joi.object({
  body: Joi.object({
    loteUuid: uuidRef.required(),
    codigo: Joi.string().min(1).max(30).required(),
    categoriaPlantaUuid: uuidRef.required(),
    latitud: coordRule,
    longitud: coordRule,
    estado: Joi.boolean(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const updatePlantaSchema = Joi.object({
  body: Joi.object({
    loteUuid: uuidRef,
    codigo: Joi.string().min(1).max(30),
    categoriaPlantaUuid: uuidRef,
    latitud: coordRule,
    longitud: coordRule,
    estado: Joi.boolean(),
  }).min(1),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});
