import Joi from 'joi';

export const createAlmacenSchema = Joi.object({
  body: Joi.object({
    codigo: Joi.string().trim().max(20).allow(null, ''),
    nombre: Joi.string().trim().max(150).required(),
    descripcion: Joi.string().allow(null, '').max(500),
    tipo: Joi.string().valid('ALMACEN', 'CENTRO_COSTO').default('ALMACEN'),
    parentUuid: Joi.string().uuid().allow(null),
    ubicacionFincaUuid: Joi.string().uuid().allow(null),
    responsableUuid: Joi.string().uuid().allow(null),
    estado: Joi.boolean().default(true),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const updateAlmacenSchema = Joi.object({
  body: Joi.object({
    codigo: Joi.string().trim().max(20).allow(null, ''),
    nombre: Joi.string().trim().max(150),
    descripcion: Joi.string().allow(null, '').max(500),
    tipo: Joi.string().valid('ALMACEN', 'CENTRO_COSTO'),
    parentUuid: Joi.string().uuid().allow(null),
    ubicacionFincaUuid: Joi.string().uuid().allow(null),
    responsableUuid: Joi.string().uuid().allow(null),
    estado: Joi.boolean(),
  }).min(1),
  params: Joi.object({ uuid: Joi.string().uuid().required() }),
  query: Joi.object({}),
});

export const getAlmacenSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: Joi.string().uuid().required() }),
  query: Joi.object({}),
});

export const listAlmacenSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50),
    search: Joi.string().allow('', null),
    tipo: Joi.string().valid('ALMACEN', 'CENTRO_COSTO'),
    parentUuid: Joi.string().uuid(),
    estado: Joi.boolean(),
  }),
});
