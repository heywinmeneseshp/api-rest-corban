import Joi from 'joi';

export const createCategoriaSchema = Joi.object({
  nombre: Joi.string().trim().max(150).required(),
  descripcion: Joi.string().allow(null, '').max(500),
  tipo: Joi.string().valid('INSUMO', 'REPUESTO', 'ELABORADO', 'GENERAL').default('GENERAL'),
  estado: Joi.boolean().default(true),
});

export const updateCategoriaSchema = Joi.object({
  nombre: Joi.string().trim().max(150),
  descripcion: Joi.string().allow(null, '').max(500),
  tipo: Joi.string().valid('INSUMO', 'REPUESTO', 'ELABORADO', 'GENERAL'),
  estado: Joi.boolean(),
}).min(1);

export const getCategoriaSchema = Joi.object({
  uuid: Joi.string().uuid().required(),
});

export const listCategoriaSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
  search: Joi.string().allow('', null),
  tipo: Joi.string().valid('INSUMO', 'REPUESTO', 'ELABORADO', 'GENERAL'),
  estado: Joi.boolean(),
});
