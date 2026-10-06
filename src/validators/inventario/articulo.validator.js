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
    // Dosificación de referencia — solo aplica a insumos (categoría
    // INSUMO), ver articulo.model.js. Opcional para cualquier artículo, el
    // frontend solo la muestra cuando corresponde. Si se registra la
    // dosis, la unidad pasa a ser obligatoria — pedido explícito: un
    // número de dosis sin unidad no sirve para nada (Mezclas no puede
    // calcular "Dosis real"/"% sobre dosis" sin ella, ver
    // mezcla.repository.js/aspersionProgramacion.service.js).
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
    // Almacenes a los que queda asignado el artículo — sin ninguno, es
    // visible/seleccionable en TODOS los almacenes (ver
    // utils/almacenScope.js). Reemplaza el conjunto completo, igual criterio
    // que setComponentes en Mezclas.
    almacenUuids: Joi.array().items(Joi.string().uuid()).default([]),
    // Ingredientes activos que componen este artículo (N:M, opcional) —
    // reemplaza el conjunto completo, igual criterio que almacenUuids.
    ingredientesActivoUuids: Joi.array().items(Joi.string().uuid()).default([]),
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
    // Misma exigencia que en crear (dosis sin unidad no sirve) — solo se
    // dispara si ESTA petición trae dosisPorHectarea como número; si no la
    // toca (edición parcial de otro campo), no exige nada de dosis.
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
    // Filtra a los artículos asignados a este almacén (más los que no tienen
    // ningún almacén asignado, que son visibles en todos) — para los
    // selectores de artículo que ya tienen un almacén elegido (Movimientos,
    // Mezclas, Aspersiones...).
    almacenUuid: Joi.string().uuid(),
  }),
});
