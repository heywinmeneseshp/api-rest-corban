import Joi from 'joi';

export const historicoSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    fechaDesde: Joi.date().iso(),
    fechaHasta: Joi.date().iso(),
  }),
});

export const sincronizarSchema = Joi.object({
  body: Joi.object({
    fecha: Joi.date().iso(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});
