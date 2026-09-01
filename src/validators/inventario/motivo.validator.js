import Joi from 'joi';

export const createMotivoSchema = Joi.object({
  body: Joi.object({
    codigo: Joi.string().trim().max(50).allow(null, ''),
    nombre: Joi.string().trim().max(150).required(),
    descripcion: Joi.string().allow(null, '').max(500),
    tipo: Joi.string().valid('AJUSTE', 'SALIDA', 'TRANSFERENCIA', 'ELABORACION', 'OTRO').default('OTRO'),
    requiereObservacion: Joi.boolean().default(false),
    estado: Joi.boolean().default(true),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const updateMotivoSchema = Joi.object({
  body: Joi.object({
    codigo: Joi.string().trim().max(50).allow(null, ''),
    nombre: Joi.string().trim().max(150),
    descripcion: Joi.string().allow(null, '').max(500),
    tipo: Joi.string().valid('AJUSTE', 'SALIDA', 'TRANSFERENCIA', 'ELABORACION', 'OTRO'),
    requiereObservacion: Joi.boolean(),
    estado: Joi.boolean(),
  }).min(1),
  params: Joi.object({ uuid: Joi.string().uuid().required() }),
  query: Joi.object({}),
});

export const getMotivoSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: Joi.string().uuid().required() }),
  query: Joi.object({}),
});

export const listMotivoSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50),
    search: Joi.string().allow('', null),
    tipo: Joi.string().valid('AJUSTE', 'SALIDA', 'TRANSFERENCIA', 'ELABORACION', 'OTRO'),
    estado: Joi.boolean(),
  }),
});
