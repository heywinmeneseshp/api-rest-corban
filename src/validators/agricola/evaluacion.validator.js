import Joi from 'joi';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();
const uuidRef = Joi.string().guid({ version: 'uuidv4' });

export const listEvaluacionesSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    fechaDesde: Joi.date().iso().raw(),
    fechaHasta: Joi.date().iso().raw(),
    fincaUuid: uuidRef,
    loteUuid: uuidRef,
    semanaUuid: uuidRef,
    usuarioUuid: uuidRef,
    tipoEvaluacionUuid: uuidRef,
  }),
});

export const getEvaluacionSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const promedioPorSemanaSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    fincaUuid: uuidRef,
    anio: Joi.number().integer().min(2000).max(2100),
  }),
});

export const indicadoresSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    semanaUuid: uuidRef,
    fincaUuid: uuidRef,
    usuarioUuid: uuidRef,
    loteUuid: uuidRef,
    anio: Joi.number().integer().min(2000).max(2100),
  }),
});

export const createEvaluacionSchema = Joi.object({
  body: Joi.object({
    plantaUuid: uuidRef.required(),
    tipoEvaluacionUuid: uuidRef.required(),
    semanaUuid: uuidRef.required(),
    usuarioUuid: uuidRef,
    fecha: Joi.date().iso().raw().required(),
    observacion: Joi.string().max(2000).allow('', null),
    estado: Joi.boolean(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const updateEvaluacionSchema = Joi.object({
  body: Joi.object({
    plantaUuid: uuidRef,
    tipoEvaluacionUuid: uuidRef,
    semanaUuid: uuidRef,
    usuarioUuid: uuidRef,
    fecha: Joi.date().iso().raw(),
    observacion: Joi.string().max(2000).allow('', null),
    estado: Joi.boolean(),
  }).min(1),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});
