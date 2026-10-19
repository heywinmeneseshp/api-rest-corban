import Joi from 'joi';

export const opcionesUcEmbolseSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const calcularUcEmbolseSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    fuente: Joi.string().max(80).required(), // 'estacion', 'estacion2' o 'finca:<uuid>'
    baseUc: Joi.number().min(0).max(50).required(),
    anio: Joi.number().integer().min(2000).max(2100).required(),
    semanaDesde: Joi.number().integer().min(1).max(53),
    semanaHasta: Joi.number().integer().min(1).max(53),
    edadMax: Joi.number().integer().min(1).max(40).default(12),
  }),
});
