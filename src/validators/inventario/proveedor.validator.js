import Joi from 'joi';

export const createProveedorSchema = Joi.object({
  body: Joi.object({
    nombre: Joi.string().trim().max(150).required(),
    identificacion: Joi.string().trim().max(50).allow(null, ''),
    telefono: Joi.string().trim().max(30).allow(null, ''),
    email: Joi.string().trim().email({ tlds: { allow: false } }).allow(null, ''),
    direccion: Joi.string().trim().max(255).allow(null, ''),
    observaciones: Joi.string().allow(null, '').max(1000),
    estado: Joi.boolean().default(true),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const updateProveedorSchema = Joi.object({
  body: Joi.object({
    nombre: Joi.string().trim().max(150),
    identificacion: Joi.string().trim().max(50).allow(null, ''),
    telefono: Joi.string().trim().max(30).allow(null, ''),
    email: Joi.string().trim().email({ tlds: { allow: false } }).allow(null, ''),
    direccion: Joi.string().trim().max(255).allow(null, ''),
    observaciones: Joi.string().allow(null, '').max(1000),
    estado: Joi.boolean(),
  }).min(1),
  params: Joi.object({ uuid: Joi.string().uuid().required() }),
  query: Joi.object({}),
});

export const getProveedorSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: Joi.string().uuid().required() }),
  query: Joi.object({}),
});

export const listProveedorSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50),
    search: Joi.string().allow('', null),
    estado: Joi.boolean(),
  }),
});
