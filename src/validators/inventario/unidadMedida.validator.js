import Joi from 'joi';

export const createUnidadSchema = Joi.object({
  body: Joi.object({
    codigo: Joi.string().trim().max(20).required(),
    nombre: Joi.string().trim().max(100).required(),
    simbolo: Joi.string().trim().max(20).required(),
    tipo: Joi.string().valid('MASA', 'VOLUMEN', 'UNIDAD', 'LONGITUD', 'SUPERFICIE', 'TIEMPO', 'OTRO').default('OTRO'),
    estado: Joi.boolean().default(true),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const updateUnidadSchema = Joi.object({
  body: Joi.object({
    codigo: Joi.string().trim().max(20),
    nombre: Joi.string().trim().max(100),
    simbolo: Joi.string().trim().max(20),
    tipo: Joi.string().valid('MASA', 'VOLUMEN', 'UNIDAD', 'LONGITUD', 'SUPERFICIE', 'TIEMPO', 'OTRO'),
    estado: Joi.boolean(),
  }).min(1),
  params: Joi.object({ uuid: Joi.string().uuid().required() }),
  query: Joi.object({}),
});

export const getUnidadSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: Joi.string().uuid().required() }),
  query: Joi.object({}),
});

export const listUnidadSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50),
    search: Joi.string().allow('', null),
    tipo: Joi.string().valid('MASA', 'VOLUMEN', 'UNIDAD', 'LONGITUD', 'SUPERFICIE', 'TIEMPO', 'OTRO'),
    estado: Joi.boolean(),
  }),
});

export const createConversionSchema = Joi.object({
  body: Joi.object({
    unidadOrigenUuid: Joi.string().uuid().required(),
    unidadDestinoUuid: Joi.string().uuid().required(),
    factor: Joi.number().positive().required(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const getConversionSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: Joi.string().uuid().required() }),
  query: Joi.object({}),
});
