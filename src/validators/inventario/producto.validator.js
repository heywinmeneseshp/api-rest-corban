import Joi from 'joi';

export const createProductoInventarioSchema = Joi.object({
  codigo: Joi.string().trim().max(20).allow(null, ''),
  nombre: Joi.string().trim().max(150).required(),
  descripcion: Joi.string().allow(null, '').max(1000),
  tipo: Joi.string().valid('INSUMO', 'REPUESTO', 'ELABORADO', 'GENERAL').default('GENERAL'),
  categoriaUuid: Joi.string().uuid().allow(null),
  unidadMedidaUuid: Joi.string().uuid().allow(null),
  costoCompra: Joi.number().min(0).default(0),
  precioVenta: Joi.number().min(0).default(0),
  manejaInventario: Joi.boolean().default(true),
  stockMinimo: Joi.number().min(0).allow(null).default(0),
  stockMaximo: Joi.number().min(0).allow(null),
  estado: Joi.boolean().default(true),
});

export const updateProductoInventarioSchema = Joi.object({
  codigo: Joi.string().trim().max(20).allow(null, ''),
  nombre: Joi.string().trim().max(150),
  descripcion: Joi.string().allow(null, '').max(1000),
  tipo: Joi.string().valid('INSUMO', 'REPUESTO', 'ELABORADO', 'GENERAL'),
  categoriaUuid: Joi.string().uuid().allow(null),
  unidadMedidaUuid: Joi.string().uuid().allow(null),
  costoCompra: Joi.number().min(0),
  precioVenta: Joi.number().min(0),
  manejaInventario: Joi.boolean(),
  stockMinimo: Joi.number().min(0).allow(null),
  stockMaximo: Joi.number().min(0).allow(null),
  estado: Joi.boolean(),
}).min(1);

export const getProductoSchema = Joi.object({
  uuid: Joi.string().uuid().required(),
});

export const listProductoSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
  search: Joi.string().allow('', null),
  tipo: Joi.string().valid('INSUMO', 'REPUESTO', 'ELABORADO', 'GENERAL'),
  categoriaUuid: Joi.string().uuid(),
  unidadMedidaUuid: Joi.string().uuid(),
  estado: Joi.boolean(),
  manejaInventario: Joi.boolean(),
});
