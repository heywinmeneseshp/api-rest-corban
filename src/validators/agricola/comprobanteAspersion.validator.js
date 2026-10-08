import Joi from 'joi';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();

export const getComprobanteAspersionSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const listComprobanteAspersionSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50),
    estado: Joi.string().valid('BORRADOR', 'EMITIDO'),
    fincaUuid: Joi.string().guid({ version: 'uuidv4' }),
    semanaUuid: Joi.string().guid({ version: 'uuidv4' }),
    search: Joi.string().allow('', null),
    fechaDesde: Joi.date().iso(),
    fechaHasta: Joi.date().iso(),
  }),
});

export const updateComprobanteAspersionSchema = Joi.object({
  body: Joi.object({
    piloto: Joi.string().trim().max(150).allow(null, ''),
    medio: Joi.string().valid('AVION', 'DRON').allow(null),
    hectareasAplicadas: Joi.number().positive(),
    galonesTotales: Joi.number().min(0),
    observaciones: Joi.string().allow(null, '').max(1000),
    aeronave: Joi.string().trim().max(150).allow(null, ''),
    volumenAplicacionHa: Joi.number().min(0).allow(null),
    temperaturaInicial: Joi.number().min(-10).max(60).allow(null),
    temperaturaFinal: Joi.number().min(-10).max(60).allow(null),
    velocidadViento: Joi.number().min(0).allow(null),
    humedadRelativaFinal: Joi.number().min(0).max(100).allow(null),
    horaInicio: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/).allow(null, ''),
    horaFinal: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/).allow(null, ''),
  }).min(1),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});
