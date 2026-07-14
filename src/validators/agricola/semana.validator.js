import Joi from 'joi';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();

export const listSemanasSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    anio: Joi.number().integer().min(2000).max(2100),
  }),
});

export const getSemanaSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const createSemanaSchema = Joi.object({
  body: Joi.object({
    codigo: Joi.string().min(1).max(20).required(),
    numeroSemana: Joi.number().integer().min(1).max(53).required(),
    anio: Joi.number().integer().min(2000).max(2100).required(),
    fechaInicio: Joi.date().iso().raw().required(),
    fechaFin: Joi.date().iso().min(Joi.ref('fechaInicio')).raw().required(),
    estado: Joi.boolean(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const updateSemanaSchema = Joi.object({
  body: Joi.object({
    codigo: Joi.string().min(1).max(20),
    numeroSemana: Joi.number().integer().min(1).max(53),
    anio: Joi.number().integer().min(2000).max(2100),
    fechaInicio: Joi.date().iso().raw(),
    fechaFin: Joi.date().iso().raw(),
    estado: Joi.boolean(),
  }).min(1),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});
