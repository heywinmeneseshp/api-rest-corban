import Joi from 'joi';

export const loginSchema = Joi.object({
  body: Joi.object({
    usuario: Joi.string().required(),
    password: Joi.string().required(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const refreshSchema = Joi.object({
  body: Joi.object({
    refreshToken: Joi.string().required(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const logoutSchema = Joi.object({
  body: Joi.object({
    refreshToken: Joi.string().required(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});
