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
    estado: Joi.string().valid('BORRADOR', 'EMITIDO', 'ANULADO'),
    fincaUuid: Joi.string().guid({ version: 'uuidv4' }),
    semanaUuid: Joi.string().guid({ version: 'uuidv4' }),
    search: Joi.string().allow('', null),
    fechaDesde: Joi.date().iso(),
    fechaHasta: Joi.date().iso(),
    eliminados: Joi.boolean(),
  }),
});

export const updateComprobanteAspersionSchema = Joi.object({
  body: Joi.object({
    piloto: Joi.string().trim().max(150).allow(null, ''),
    // Con dron: piloto y asistentes del listado de colaboradores.
    pilotoColaboradorUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null),
    asistentesUuids: Joi.array().items(Joi.string().guid({ version: 'uuidv4' })).max(30),
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
    // Datos del reporte operacional de fumigación.
    tipoEquipo: Joi.string().trim().max(150).allow(null, ''),
    alturaVuelo: Joi.string().trim().max(50).allow(null, ''),
    anchoDeposicion: Joi.number().min(0).max(1000).allow(null),
    concentracionIa: Joi.number().min(0).max(100000).allow(null),
    personaAutoriza: Joi.string().trim().max(150).allow(null, ''),
    tiempoReentrada: Joi.number().min(0).max(1000).allow(null),
    tiempoCarencia: Joi.number().min(0).max(10000).allow(null),
    manipuladores: Joi.array()
      .items(Joi.object({ colaboradorUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null), nombre: Joi.string().trim().max(150).required(), documento: Joi.string().trim().max(30).allow(null, '') }))
      .max(20),
  }).min(1),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const anularComprobanteAspersionSchema = Joi.object({
  body: Joi.object({
    motivo: Joi.string().trim().min(5).max(500).required(),
  }),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

// Hectáreas asperjadas por colaborador (pilotos de dron y asistentes).
export const reporteHectareasSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    desde: Joi.date().iso(),
    hasta: Joi.date().iso(),
    colaboradorUuid: Joi.string().guid({ version: 'uuidv4' }),
    cargoUuid: Joi.string().guid({ version: 'uuidv4' }),
    soloEmitidos: Joi.boolean(),
  }),
});

// Un recorrido (KML) puntual del comprobante.
export const kmlComprobanteSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam, kmlUuid: uuidParam }),
  query: Joi.object({}),
});
