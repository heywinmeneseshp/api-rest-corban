import Joi from 'joi';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();
const uuidRef = Joi.string().guid({ version: 'uuidv4' });

const TIPOS = ['EMBOLSE', 'REPIQUE', 'RECUSE', 'CORTE'];

export const listRacimoMovimientosSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    fincaUuid: uuidRef,
    loteUuid: uuidRef,
    semanaEmbolseUuid: uuidRef,
    tipo: Joi.string().valid(...TIPOS),
    fechaDesde: Joi.date().iso().raw(),
    fechaHasta: Joi.date().iso().raw(),
  }),
});

export const getRacimoMovimientoSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const createRacimoMovimientoSchema = Joi.object({
  body: Joi.object({
    fincaUuid: uuidRef.required(),
    loteUuid: uuidRef.required(),
    semanaEmbolseUuid: uuidRef.required(),
    semanaRegistroUuid: uuidRef,
    tipo: Joi.string().valid(...TIPOS).required(),
    motivoRepiqueUuid: uuidRef,
    motivoRecuseUuid: uuidRef,
    cantidad: Joi.number().integer().min(1).required(),
    fecha: Joi.date().iso().raw().required(),
    observacion: Joi.string().max(255).allow('', null),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const resumenCohorteSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    fincaUuid: uuidRef.required(),
    loteUuid: uuidRef.required(),
    semanaEmbolseUuid: uuidRef.required(),
  }),
});

export const inventarioRacimosSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    fincaUuid: uuidRef,
    loteUuid: uuidRef,
    semanaActualUuid: uuidRef,
    cantidadSemanas: Joi.number().integer().min(1).max(53),
  }),
});
