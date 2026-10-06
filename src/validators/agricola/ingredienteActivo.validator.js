import Joi from 'joi';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();

export const listIngredientesActivosSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    search: Joi.string().allow('').max(150),
    estado: Joi.boolean(),
  }),
});

export const getIngredienteActivoSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const createIngredienteActivoSchema = Joi.object({
  body: Joi.object({
    // `.trim()` — sin esto, " Mancozeb" y "Mancozeb" pasan la restricción
    // UNIQUE de la base como si fueran nombres distintos (la unicidad de
    // MySQL en `nombre` ya es case-insensitive, pero no ignora espacios).
    nombre: Joi.string().trim().min(2).max(150).required(),
    descripcion: Joi.string().max(255).allow('', null),
    estado: Joi.boolean(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const updateIngredienteActivoSchema = Joi.object({
  body: Joi.object({
    nombre: Joi.string().trim().min(2).max(150),
    descripcion: Joi.string().max(255).allow('', null),
    estado: Joi.boolean(),
  }).min(1),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});
