import Joi from 'joi';

export const historicoSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    fechaDesde: Joi.date().iso(),
    fechaHasta: Joi.date().iso(),
  }),
});

export const sincronizarSchema = Joi.object({
  body: Joi.object({
    fecha: Joi.date().iso(),
    fechaDesde: Joi.date().iso(),
    fechaHasta: Joi.date().iso().min(Joi.ref('fechaDesde')),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const sincronizarFaltantesSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const ucBasesSchema = Joi.object({
  body: Joi.object({
    bases: Joi.array().items(Joi.number().min(0).max(50)).min(1).max(6).required(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const openMeteoListarSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    fincaUuids: Joi.string().allow(''), // uuids separados por coma
    fechaDesde: Joi.date().iso(),
    fechaHasta: Joi.date().iso(),
  }),
});

export const openMeteoActualizarSchema = Joi.object({
  body: Joi.object({
    fechaDesde: Joi.date().iso(),
    fechaHasta: Joi.date().iso(),
    fincaUuids: Joi.array().items(Joi.string().guid({ version: 'uuidv4' })),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const openMeteoConfigSchema = Joi.object({
  body: Joi.object({ frecuencia: Joi.string().valid('DIARIA', 'SEMANAL', 'MENSUAL').required() }),
  params: Joi.object({}),
  query: Joi.object({}),
});
