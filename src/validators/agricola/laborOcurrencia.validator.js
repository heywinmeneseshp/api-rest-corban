import Joi from 'joi';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();
const uuidRef = Joi.string().guid({ version: 'uuidv4' });
const fechaIso = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/);
const horaStr = Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/);

export const listLaborOcurrenciasSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    fincaUuid: uuidRef.required(),
    anio: Joi.number().integer().min(2000).max(2100).required(),
  }),
});

export const getLaborOcurrenciaSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

const ALCANCES = ['ESTA', 'ESTA_Y_SIGUIENTES', 'TODA_LA_SERIE'];

export const updateLaborOcurrenciaSchema = Joi.object({
  body: Joi.object({
    alcance: Joi.string().valid(...ALCANCES).default('ESTA'),
    laborUuid: uuidRef,
    // Mover la fecha solo tiene sentido para esta ocurrencia o como ancla de
    // la serie-continuación en "esta y las siguientes" — no para toda la
    // serie a la vez (movería todas las ocurrencias al mismo día).
    fecha: fechaIso.when('alcance', { is: 'TODA_LA_SERIE', then: Joi.forbidden() }),
    hora: horaStr.allow(null, ''),
    duracionMinutos: Joi.number().integer().min(1).allow(null),
    responsableUuid: uuidRef.allow(null),
    observaciones: Joi.string().max(500).allow('', null),
    // El estado de UNA ocurrencia (completada/cancelada) no aplica en bloque
    // a varias — solo tiene sentido con alcance ESTA.
    estado: Joi.string()
      .valid('PROGRAMADA', 'COMPLETADA', 'CANCELADA')
      .when('alcance', { is: Joi.valid('ESTA_Y_SIGUIENTES', 'TODA_LA_SERIE'), then: Joi.forbidden() }),
  }),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const deleteLaborOcurrenciaSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({ alcance: Joi.string().valid(...ALCANCES).default('ESTA') }),
});
