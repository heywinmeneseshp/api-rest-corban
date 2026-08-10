import Joi from 'joi';

const querySchema = Joi.object({
  fincaUuids: Joi.string(), // CSV de uuids; vacío = todas las fincas permitidas
  semanaInicioUuid: Joi.string().guid({ version: 'uuidv4' }),
  semanas: Joi.number().integer().min(1).max(53).default(8), // hasta un año calendario completo
  pctNoCosechado: Joi.number().min(0).max(0.9),
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
