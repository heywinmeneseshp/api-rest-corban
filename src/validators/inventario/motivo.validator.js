import Joi from 'joi';

export const createMotivoSchema = Joi.object({
  codigo: Joi.string().trim().max(50).allow(null, ''),
  nombre: Joi.string().trim().max(150).required(),
  descripcion: Joi.string().allow(null, '').max(500),
  tipo: Joi.string().valid('AJUSTE', 'SALIDA', 'TRANSFERENCIA', 'ELABORACION', 'OTRO').default('OTRO'),
  requiereObservacion: Joi.boolean().default(false),
  estado: Joi.boolean().default(true),
});

export const updateMotivoSchema = Joi.object({
  codigo: Joi.string().trim().max(50).allow(null, ''),
  nombre: Joi.string().trim().max(150),
  descripcion: Joi.string().allow(null, '').max(500),
  tipo: Joi.string().valid('AJUSTE', 'SALIDA', 'TRANSFERENCIA', 'ELABORACION', 'OTRO'),
  requiereObservacion: Joi.boolean(),
  estado: Joi.boolean(),
}).min(1);

export const getMotivoSchema = Joi.object({
  uuid: Joi.string().uuid().required(),
});

export const listMotivoSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
  search: Joi.string().allow('', null),
  tipo: Joi.string().valid('AJUSTE', 'SALIDA', 'TRANSFERENCIA', 'ELABORACION', 'OTRO'),
  estado: Joi.boolean(),
});
