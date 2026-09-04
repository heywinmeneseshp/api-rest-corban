import Joi from 'joi';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();

export const listZonasSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    search: Joi.string().allow('').max(150),
  }),
});

export const getZonaSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const createZonaSchema = Joi.object({
  body: Joi.object({
    nombre: Joi.string().min(2).max(100).required(),
    estado: Joi.boolean(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const updateZonaSchema = Joi.object({
  body: Joi.object({
    nombre: Joi.string().min(2).max(100),
    estado: Joi.boolean(),
  }).min(1),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const assignFincaZonaSchema = Joi.object({
  body: Joi.object({
    fincaUuid: Joi.string().guid({ version: 'uuidv4' }).required(),
  }),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const removeFincaZonaSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({
    uuid: uuidParam,
    fincaUuid: Joi.string().guid({ version: 'uuidv4' }).required(),
  }),
  query: Joi.object({}),
});
