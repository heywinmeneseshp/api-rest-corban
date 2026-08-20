import Joi from 'joi';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();
const uuidRef = Joi.string().guid({ version: 'uuidv4' });

const laboresSchema = Joi.array().items(
  Joi.object({
    laborUuid: uuidRef.required(),
    calificacion: Joi.number().integer().min(1).max(5).required(),
  }),
);

export const listColaboradoresSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    search: Joi.string().allow('').max(150),
    fincaUuid: uuidRef,
    estado: Joi.boolean(),
  }),
});

export const getColaboradorSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const createColaboradorSchema = Joi.object({
  body: Joi.object({
    nombre: Joi.string().min(2).max(150).required(),
    documento: Joi.string().allow('', null).max(30),
    telefono: Joi.string().allow('', null).max(30),
    fincaUuid: uuidRef.allow(null),
    estado: Joi.boolean(),
    labores: laboresSchema,
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const updateColaboradorSchema = Joi.object({
  body: Joi.object({
    nombre: Joi.string().min(2).max(150),
    documento: Joi.string().allow('', null).max(30),
    telefono: Joi.string().allow('', null).max(30),
    fincaUuid: uuidRef.allow(null),
    estado: Joi.boolean(),
    labores: laboresSchema,
  }).min(1),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});
