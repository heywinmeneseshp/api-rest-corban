import Joi from 'joi';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();

export const createProgramacionSchema = Joi.object({
  body: Joi.object({
    planUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null, ''),
    equipoUuid: Joi.string().guid({ version: 'uuidv4' }).required(),
    fechaProgramada: Joi.date().iso().required(),
    responsableUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null, ''),
    estado: Joi.string().valid('PENDIENTE', 'PROGRAMADA', 'EN_CURSO', 'COMPLETADA', 'CANCELADA', 'VENCIDA').default('PENDIENTE'),
    prioridad: Joi.string().valid('BAJA', 'MEDIA', 'ALTA', 'CRITICA').default('MEDIA'),
    observaciones: Joi.string().allow(null, '').max(1000),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const updateProgramacionSchema = Joi.object({
  body: Joi.object({
    planUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null, ''),
    equipoUuid: Joi.string().guid({ version: 'uuidv4' }),
    fechaProgramada: Joi.date().iso(),
    fechaEjecucion: Joi.date().iso().allow(null, ''),
    responsableUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null, ''),
    estado: Joi.string().valid('PENDIENTE', 'PROGRAMADA', 'EN_CURSO', 'COMPLETADA', 'CANCELADA', 'VENCIDA'),
    prioridad: Joi.string().valid('BAJA', 'MEDIA', 'ALTA', 'CRITICA'),
    observaciones: Joi.string().allow(null, '').max(1000),
  }).min(1),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const getProgramacionSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const listProgramacionSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50),
    equipoUuid: Joi.string().guid({ version: 'uuidv4' }),
    planUuid: Joi.string().guid({ version: 'uuidv4' }),
    estado: Joi.string().valid('PENDIENTE', 'PROGRAMADA', 'EN_CURSO', 'COMPLETADA', 'CANCELADA', 'VENCIDA'),
    prioridad: Joi.string().valid('BAJA', 'MEDIA', 'ALTA', 'CRITICA'),
    fechaDesde: Joi.date().iso(),
    fechaHasta: Joi.date().iso(),
  }),
});
