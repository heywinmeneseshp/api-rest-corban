import Joi from 'joi';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();
const uuidRef = Joi.string().guid({ version: 'uuidv4' });
const colorHex = Joi.string().pattern(/^#[0-9a-fA-F]{6}$/);

export const listLaboresSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    search: Joi.string().allow('').max(150),
    categoriaLaborUuid: uuidRef,
  }),
});

export const getLaborSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const createLaborSchema = Joi.object({
  body: Joi.object({
    categoriaLaborUuid: uuidRef.required(),
    nombre: Joi.string().min(2).max(150).required(),
    color: colorHex,
    icono: Joi.string().max(40),
    duracionDefaultMinutos: Joi.number().integer().min(1).allow(null),
    estado: Joi.boolean(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const updateLaborSchema = Joi.object({
  body: Joi.object({
    categoriaLaborUuid: uuidRef,
    nombre: Joi.string().min(2).max(150),
    color: colorHex,
    icono: Joi.string().max(40),
    duracionDefaultMinutos: Joi.number().integer().min(1).allow(null),
    estado: Joi.boolean(),
  }).min(1),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});
