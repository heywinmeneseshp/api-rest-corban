import Joi from 'joi';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();

export const createElaboracionSchema = Joi.object({
  body: Joi.object({
    mezclaVersionUuid: Joi.string().guid({ version: 'uuidv4' }).required(),
    almacenUuid: Joi.string().guid({ version: 'uuidv4' }).required(),
    cantidadElaborada: Joi.number().positive().required(),
    fecha: Joi.date().iso().required(),
    documento: Joi.string().trim().max(50).allow(null, ''),
    observaciones: Joi.string().allow(null, '').max(1000),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const getElaboracionSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const listElaboracionSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50),
    mezclaUuid: Joi.string().guid({ version: 'uuidv4' }),
    mezclaVersionUuid: Joi.string().guid({ version: 'uuidv4' }),
    almacenUuid: Joi.string().guid({ version: 'uuidv4' }),
    fechaDesde: Joi.date().iso(),
    fechaHasta: Joi.date().iso(),
  }),
});
