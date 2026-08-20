import Joi from 'joi';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();

export const listProductosSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    search: Joi.string().allow('').max(150),
  }),
});

export const getProductoSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

const camposProducto = {
  nombre: Joi.string().min(2).max(150),
  codigo: Joi.string().max(20).allow('', null),
  pesoNeto: Joi.number().min(0).allow(null),
  pesoBruto: Joi.number().min(0).allow(null),
  cajasPorPalet: Joi.number().integer().min(0).allow(null),
  cajasPorMinipalet: Joi.number().integer().min(0).allow(null),
  cantidadPalets: Joi.number().integer().min(0).allow(null),
  cantidadMinipalets: Joi.number().integer().min(0).allow(null),
  estado: Joi.boolean(),
};

export const createProductoSchema = Joi.object({
  body: Joi.object({ ...camposProducto, nombre: camposProducto.nombre.required() }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const updateProductoSchema = Joi.object({
  body: Joi.object(camposProducto).min(1),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const syncBanaricaProductosSchema = Joi.object({
  body: Joi.object({
    consecutivos: Joi.array().items(Joi.string()).min(1).required(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});
