import Joi from 'joi';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();

const componenteSchema = Joi.object({
  productoUuid: Joi.string().guid({ version: 'uuidv4' }).required(),
  cantidad: Joi.number().positive().required(),
  unidadUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null, ''),
});

export const createMezclaSchema = Joi.object({
  body: Joi.object({
    codigo: Joi.string().trim().max(50).allow(null, ''),
    nombre: Joi.string().trim().max(150).required(),
    descripcion: Joi.string().allow(null, '').max(1000),
    productoElaboradoUuid: Joi.string().guid({ version: 'uuidv4' }).required(),
    unidadRendimientoUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null, ''),
    rendimiento: Joi.number().positive().required(),
    precioVenta: Joi.number().min(0).allow(null).default(0),
    estado: Joi.boolean().default(true),
    componentes: Joi.array().items(componenteSchema).min(1).required(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const updateMezclaSchema = Joi.object({
  body: Joi.object({
    codigo: Joi.string().trim().max(50).allow(null, ''),
    nombre: Joi.string().trim().max(150),
    descripcion: Joi.string().allow(null, '').max(1000),
    productoElaboradoUuid: Joi.string().guid({ version: 'uuidv4' }),
    unidadRendimientoUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null, ''),
    rendimiento: Joi.number().positive(),
    precioVenta: Joi.number().min(0).allow(null),
    estado: Joi.boolean(),
    componentes: Joi.array().items(componenteSchema).min(1),
  }).min(1),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const getMezclaSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const listMezclaSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50),
    search: Joi.string().allow('', null),
    estado: Joi.boolean(),
    productoElaboradoUuid: Joi.string().guid({ version: 'uuidv4' }),
  }),
});
