import Joi from 'joi';

export const updateBanaricaUrlSchema = Joi.object({
  body: Joi.object({
    url: Joi.string().uri({ scheme: ['http', 'https'] }).max(255).required(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const updateLogisticaSchema = Joi.object({
  body: Joi.object({
    url: Joi.string().uri({ scheme: ['http', 'https'] }).max(255).required(),
    // Vacío/omitido = conservar la API key ya guardada.
    apiKey: Joi.string().max(200).allow('', null),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const updateTasaConversionSchema = Joi.object({
  body: Joi.object({
    peso: Joi.number().positive().required(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

// x.y.z — se compara por partes (no como string) en la app móvil.
const SEMVER = /^\d+\.\d+\.\d+$/;

export const updateAppVersionInfoSchema = Joi.object({
  body: Joi.object({
    latestVersion: Joi.string().pattern(SEMVER).required(),
    minSupportedVersion: Joi.string().pattern(SEMVER).required(),
    downloadUrl: Joi.string().uri({ scheme: ['http', 'https'] }).max(500).allow('', null),
    releaseNotes: Joi.string().max(1000).allow('', null),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const updateMarcaAppSchema = Joi.object({
  body: Joi.object({
    nombreApp: Joi.string().min(2).max(60).required(),
    // data URL base64 (ej. "data:image/png;base64,...") o null para volver
    // al logo por defecto.
    logoUrl: Joi.string().max(2_000_000).pattern(/^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,/).allow('', null),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});
