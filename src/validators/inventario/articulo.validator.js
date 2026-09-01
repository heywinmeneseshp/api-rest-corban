import Joi from 'joi';

export const createArticuloSchema = Joi.object({
  body: Joi.object({
    codigo: Joi.string().trim().max(20).allow(null, ''),
    nombre: Joi.string().trim().max(150).required(),
    descripcion: Joi.string().allow(null, '').max(1000),
    categoriaUuid: Joi.string().uuid().allow(null),
    unidadMedidaUuid: Joi.string().uuid().allow(null),
    costoCompra: Joi.number().min(0).default(0),
    precioVenta: Joi.number().min(0).default(0),
    manejaInventario: Joi.boolean().default(true),
    stockMinimo: Joi.number().min(0).allow(null).default(0),
    stockMaximo: Joi.number().min(0).allow(null),
    estado: Joi.boolean().default(true),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const updateArticuloSchema = Joi.object({
  body: Joi.object({
    codigo: Joi.string().trim().max(20).allow(null, ''),
    nombre: Joi.string().trim().max(150),
    descripcion: Joi.string().allow(null, '').max(1000),
    categoriaUuid: Joi.string().uuid().allow(null),
    unidadMedidaUuid: Joi.string().uuid().allow(null),
    costoCompra: Joi.number().min(0),
    precioVenta: Joi.number().min(0),
    manejaInventario: Joi.boolean(),
    stockMinimo: Joi.number().min(0).allow(null),
    stockMaximo: Joi.number().min(0).allow(null),
    estado: Joi.boolean(),
  }).min(1),
  params: Joi.object({ uuid: Joi.string().uuid().required() }),
  query: Joi.object({}),
});

export const getArticuloSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: Joi.string().uuid().required() }),
  query: Joi.object({}),
});

export const listArticuloSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50),
    search: Joi.string().allow('', null),
    // Filtra por el tipo de la CATEGORÍA del artículo (el artículo ya no
    // tiene su propio `tipo` — ver articulo.model.js).
    tipo: Joi.string().valid('INSUMO', 'REPUESTO', 'ELABORADO', 'GENERAL'),
    categoriaUuid: Joi.string().uuid(),
    unidadMedidaUuid: Joi.string().uuid(),
    estado: Joi.boolean(),
    manejaInventario: Joi.boolean(),
  }),
});
