import Joi from 'joi';

export const historicoSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    fechaDesde: Joi.date().iso(),
    fechaHasta: Joi.date().iso(),
    estacion: Joi.number().integer().min(1),
  }),
});

export const sincronizarSchema = Joi.object({
  body: Joi.object({
    fecha: Joi.date().iso(),
    fechaDesde: Joi.date().iso(),
    fechaHasta: Joi.date().iso().min(Joi.ref('fechaDesde')),
    estacion: Joi.number().integer().min(1),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const sincronizarFaltantesSchema = Joi.object({
  body: Joi.object({ estacion: Joi.number().integer().min(1) }),
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

export const comparativaSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    fuentes: Joi.string().allow(''), // ids separados por coma ('estacion', 'finca:<uuid>')
    fechaDesde: Joi.date().iso(),
    fechaHasta: Joi.date().iso(),
  }),
});

// ─── Administración de estaciones (alta, edición, fincas) ───
const credencial = Joi.string().trim().max(200).allow('', null);
export const estacionIdSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ id: Joi.number().integer().min(1).required() }),
  query: Joi.object({}),
});
export const estacionCrearSchema = Joi.object({
  body: Joi.object({
    nombre: Joi.string().trim().min(2).max(120).required(),
    apiKey: credencial,
    apiSecret: credencial,
    stationId: Joi.string().trim().max(60).allow('', null),
    estado: Joi.boolean(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});
export const estacionActualizarSchema = Joi.object({
  body: Joi.object({
    nombre: Joi.string().trim().min(2).max(120),
    apiKey: credencial,
    apiSecret: credencial,
    stationId: Joi.string().trim().max(60).allow('', null),
    estado: Joi.boolean(),
  }).min(1),
  params: Joi.object({ id: Joi.number().integer().min(1).required() }),
  query: Joi.object({}),
});
export const estacionFincasSchema = Joi.object({
  body: Joi.object({ fincaUuids: Joi.array().items(Joi.string().guid({ version: 'uuidv4' })).max(200).required() }),
  params: Joi.object({ id: Joi.number().integer().min(1).required() }),
  query: Joi.object({}),
});
