import Joi from 'joi';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();
const passwordRule = Joi.string().min(8).max(100).pattern(/^(?=.*[A-Za-z])(?=.*\d).+$/, 'letras y números');

export const listUsersSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    search: Joi.string().allow('').max(150),
  }),
});

export const getUserSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const createUserSchema = Joi.object({
  body: Joi.object({
    usuario: Joi.string().alphanum().min(3).max(50).required(),
    nombre: Joi.string().min(2).max(100).required(),
    apellido: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().max(150).required(),
    password: passwordRule.required(),
    estado: Joi.boolean(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const updateUserSchema = Joi.object({
  body: Joi.object({
    usuario: Joi.string().alphanum().min(3).max(50),
    nombre: Joi.string().min(2).max(100),
    apellido: Joi.string().min(2).max(100),
    email: Joi.string().email().max(150),
    password: passwordRule,
    estado: Joi.boolean(),
  }).min(1),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const assignRoleSchema = Joi.object({
  body: Joi.object({
    roleUuid: Joi.string().guid({ version: 'uuidv4' }).required(),
  }),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const removeRoleSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({
    uuid: uuidParam,
    roleUuid: Joi.string().guid({ version: 'uuidv4' }).required(),
  }),
  query: Joi.object({}),
});

export const assignFincaSchema = Joi.object({
  body: Joi.object({
    fincaUuid: Joi.string().guid({ version: 'uuidv4' }).required(),
  }),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const removeFincaSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({
    uuid: uuidParam,
    fincaUuid: Joi.string().guid({ version: 'uuidv4' }).required(),
  }),
  query: Joi.object({}),
});

const uuidArray = Joi.array().items(Joi.string().guid({ version: 'uuidv4' })).min(1).required();

export const bulkResetPasswordSchema = Joi.object({
  body: Joi.object({ uuids: uuidArray }),
  params: Joi.object({}),
  query: Joi.object({}),
});
