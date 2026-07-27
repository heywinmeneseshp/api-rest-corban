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

const passwordRule = Joi.string().min(8).max(100).pattern(/^(?=.*[A-Za-z])(?=.*\d).+$/, 'letras y números');

export const updateProfileSchema = Joi.object({
  body: Joi.object({
    nombre: Joi.string().min(2).max(100),
    apellido: Joi.string().min(2).max(100),
    email: Joi.string().email().max(150),
  }).min(1),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const changePasswordSchema = Joi.object({
  body: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: passwordRule.required(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});
