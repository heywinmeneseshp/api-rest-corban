import Joi from 'joi';

export const createUnidadSchema = Joi.object({
  codigo: Joi.string().trim().max(20).required(),
  nombre: Joi.string().trim().max(100).required(),
  simbolo: Joi.string().trim().max(20).required(),
  tipo: Joi.string().valid('MASA', 'VOLUMEN', 'UNIDAD', 'LONGITUD', 'SUPERFICIE', 'TIEMPO', 'OTRO').default('OTRO'),
  estado: Joi.boolean().default(true),
});

export const updateUnidadSchema = Joi.object({
  codigo: Joi.string().trim().max(20),
  nombre: Joi.string().trim().max(100),
  simbolo: Joi.string().trim().max(20),
  tipo: Joi.string().valid('MASA', 'VOLUMEN', 'UNIDAD', 'LONGITUD', 'SUPERFICIE', 'TIEMPO', 'OTRO'),
  estado: Joi.boolean(),
}).min(1);

export const getUnidadSchema = Joi.object({
  uuid: Joi.string().uuid().required(),
});

export const listUnidadSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
  search: Joi.string().allow('', null),
  tipo: Joi.string().valid('MASA', 'VOLUMEN', 'UNIDAD', 'LONGITUD', 'SUPERFICIE', 'TIEMPO', 'OTRO'),
  estado: Joi.boolean(),
});

export const createConversionSchema = Joi.object({
  unidadOrigenUuid: Joi.string().uuid().required(),
  unidadDestinoUuid: Joi.string().uuid().required(),
  factor: Joi.number().positive().required(),
});

export const getConversionSchema = Joi.object({
  uuid: Joi.string().uuid().required(),
});
