import Joi from 'joi';

const tipos = ['ENTRADA', 'SALIDA', 'AJUSTE_ENTRADA', 'AJUSTE_SALIDA', 'TRANSFERENCIA_SALIDA', 'TRANSFERENCIA_ENTRADA', 'ELABORACION_SALIDA', 'ELABORACION_ENTRADA'];

export const createMovimientoSchema = Joi.object({
  body: Joi.object({
    documento: Joi.string().trim().max(50).required(),
    tipo: Joi.string().valid(...tipos).required(),
    fecha: Joi.date().iso().required(),
    almacenUuid: Joi.string().uuid().required(),
    articuloUuid: Joi.string().uuid().required(),
    cantidad: Joi.number().positive().required(),
    unidadUuid: Joi.string().uuid().allow(null),
    costoUnitario: Joi.number().min(0).default(0),
    lote: Joi.string().max(50).allow(null, ''),
    fechaVencimiento: Joi.date().iso().allow(null),
    motivoUuid: Joi.string().uuid().allow(null),
    observaciones: Joi.string().allow(null, '').max(500),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const createTransferenciaSchema = Joi.object({
  body: Joi.object({
    documento: Joi.string().trim().max(50).required(),
    fecha: Joi.date().iso().required(),
    almacenOrigenUuid: Joi.string().uuid().required(),
    almacenDestinoUuid: Joi.string().uuid().required(),
    articuloUuid: Joi.string().uuid().required(),
    cantidad: Joi.number().positive().required(),
    unidadUuid: Joi.string().uuid().allow(null),
    costoUnitario: Joi.number().min(0).default(0),
    observaciones: Joi.string().allow(null, '').max(500),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const listMovimientoSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50),
    almacenUuid: Joi.string().uuid(),
    articuloUuid: Joi.string().uuid(),
    tipo: Joi.string().valid(...tipos),
    fechaDesde: Joi.date().iso(),
    fechaHasta: Joi.date().iso(),
    documento: Joi.string().allow('', null),
  }),
});

export const getMovimientoSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: Joi.string().uuid().required() }),
  query: Joi.object({}),
});

export const existenciasSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    almacenUuid: Joi.string().uuid(),
    articuloUuid: Joi.string().uuid(),
  }),
});

export const kardexSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    articuloUuid: Joi.string().uuid().required(),
    almacenUuid: Joi.string().uuid(),
    fechaDesde: Joi.date().iso(),
    fechaHasta: Joi.date().iso(),
  }),
});
