import Joi from 'joi';

export const setupEstadoSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const setupSchema = Joi.object({
  body: Joi.object({
    usuario: Joi.string().min(3).max(50).required(),
    nombre: Joi.string().min(2).max(100).required(),
    apellido: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).max(100).required(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});
