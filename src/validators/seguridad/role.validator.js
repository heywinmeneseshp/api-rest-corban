import Joi from 'joi';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();

export const listRolesSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    search: Joi.string().allow('').max(150),
  }),
});

export const getRoleSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const createRoleSchema = Joi.object({
  body: Joi.object({
    nombre: Joi.string().min(2).max(50).required(),
    descripcion: Joi.string().max(255).allow('', null),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const updateRoleSchema = Joi.object({
  body: Joi.object({
    nombre: Joi.string().min(2).max(50),
    descripcion: Joi.string().max(255).allow('', null),
  }).min(1),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const assignPermisoSchema = Joi.object({
  body: Joi.object({
    permisoUuid: Joi.string().guid({ version: 'uuidv4' }).required(),
  }),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const removePermisoSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({
    uuid: uuidParam,
    permisoUuid: Joi.string().guid({ version: 'uuidv4' }).required(),
  }),
  query: Joi.object({}),
});
