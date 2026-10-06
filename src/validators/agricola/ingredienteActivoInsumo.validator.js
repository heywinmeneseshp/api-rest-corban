import Joi from 'joi';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();

// Igual que articulo.validator.js, pero SIN categoriaUuid — los insumos
// creados desde Sanidad Vegetal siempre caen en la categoría fija
// "Sanidad Vegetal" (ver ingredienteActivoInsumo.service.js), no se elige
// en el formulario.
export const createInsumoSchema = Joi.object({
  body: Joi.object({
    codigo: Joi.string().trim().max(20).allow(null, ''),
    nombre: Joi.string().trim().max(150).required(),
    descripcion: Joi.string().allow(null, '').max(1000),
    unidadMedidaUuid: Joi.string().uuid().allow(null),
    costoCompra: Joi.number().min(0).default(0),
    precioVenta: Joi.number().min(0).default(0),
    manejaInventario: Joi.boolean().default(true),
    stockMinimo: Joi.number().min(0).allow(null).default(0),
    stockMaximo: Joi.number().min(0).allow(null),
    dosisPorHectarea: Joi.number().min(0).allow(null),
    dosisUnidadUuid: Joi.string()
      .uuid()
      .allow(null)
      .when('dosisPorHectarea', {
        is: Joi.number().required(),
        then: Joi.required().messages({
          'any.required': 'Si registras la Dosis por hectárea, también debes indicar su unidad.',
        }),
      }),
    estado: Joi.boolean().default(true),
    almacenUuids: Joi.array().items(Joi.string().uuid()).default([]),
    // Ingredientes activos que componen este insumo — opcional (N:M).
    ingredientesActivoUuids: Joi.array().items(Joi.string().uuid()).default([]),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const updateInsumoSchema = Joi.object({
  body: Joi.object({
    codigo: Joi.string().trim().max(20).allow(null, ''),
    nombre: Joi.string().trim().max(150),
    descripcion: Joi.string().allow(null, '').max(1000),
    unidadMedidaUuid: Joi.string().uuid().allow(null),
    costoCompra: Joi.number().min(0),
    precioVenta: Joi.number().min(0),
    manejaInventario: Joi.boolean(),
    stockMinimo: Joi.number().min(0).allow(null),
    stockMaximo: Joi.number().min(0).allow(null),
    dosisPorHectarea: Joi.number().min(0).allow(null),
    dosisUnidadUuid: Joi.string()
      .uuid()
      .allow(null)
      .when('dosisPorHectarea', {
        is: Joi.number().required(),
        then: Joi.required().messages({
          'any.required': 'Si registras la Dosis por hectárea, también debes indicar su unidad.',
        }),
      }),
    estado: Joi.boolean(),
    almacenUuids: Joi.array().items(Joi.string().uuid()),
    ingredientesActivoUuids: Joi.array().items(Joi.string().uuid()),
  }).min(1),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const getInsumoSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const listInsumosSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50),
    search: Joi.string().allow('', null),
    estado: Joi.boolean(),
    manejaInventario: Joi.boolean(),
    almacenUuid: Joi.string().uuid(),
  }),
});
