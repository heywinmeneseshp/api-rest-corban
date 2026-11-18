import Joi from 'joi';

const querySchema = Joi.object({
  fincaUuids: Joi.string(), // CSV de uuids; vacío = todas las fincas permitidas
  semanaInicioUuid: Joi.string().guid({ version: 'uuidv4' }),
  semanas: Joi.number().integer().min(1).max(53).default(8), // hasta un año calendario completo
  pctNoCosechado: Joi.number().min(0).max(0.9),
  // Simulación: pronostica como si hoy fuera esta fecha (pasada) y compara con lo que realmente ocurrió. Ignora semanaInicioUuid.
  ratioPasadas: Joi.number().integer().min(0).max(156),
  ratioFuturas: Joi.number().integer().min(0).max(53),
  simularDesde: Joi.string().isoDate(),
});

export const getPronosticoSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: querySchema,
});

export const exportarPronosticoSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: querySchema,
});

// Ratio editado a mano: con ratio null se quita la edición.
export const guardarRatioManualSchema = Joi.object({
  body: Joi.object({
    fincaUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null, ''),
    semanaCodigo: Joi.string().pattern(/^S\d{1,2}-\d{4}$/).required(),
    ratio: Joi.number().min(0).max(5).allow(null).required(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

// Cajas adicionales a mano: con cajas null (o 0) se quitan.
export const guardarCajasAdicionalesSchema = Joi.object({
  body: Joi.object({
    fincaUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null, ''),
    semanaCodigo: Joi.string().pattern(/^S\d{1,2}-\d{4}$/).required(),
    cajas: Joi.number().min(0).max(10000000).allow(null).required(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});
