import Joi from 'joi';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();
const uuidRef = Joi.string().guid({ version: 'uuidv4' });

export const listLotesSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    search: Joi.string().allow('').max(150),
  }),
});

export const getLoteSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const listLotePlantasSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
  }),
});

export const createLoteSchema = Joi.object({
  body: Joi.object({
    fincaUuid: uuidRef.required(),
    // El código se genera automáticamente ({codigoFinca}-{consecutivo}), pero
    // se acepta opcionalmente por si se quiere forzar uno específico.
    codigo: Joi.string().min(1).max(20),
    nombre: Joi.string().min(2).max(150).required(),
    area: Joi.number().positive().precision(2),
    estado: Joi.boolean(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const updateLoteSchema = Joi.object({
  body: Joi.object({
    fincaUuid: uuidRef,
    codigo: Joi.string().min(1).max(20),
    nombre: Joi.string().min(2).max(150),
    area: Joi.number().positive().precision(2),
    estado: Joi.boolean(),
  }).min(1),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const listAreaProduccionSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
  }),
});

export const createAreaProduccionSchema = Joi.object({
  body: Joi.object({
    area: Joi.number().positive().precision(2).required(),
    fecha: Joi.date().raw(),
  }),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});
