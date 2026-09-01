import Joi from 'joi';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();

export const createPlanSchema = Joi.object({
  body: Joi.object({
    equipoUuid: Joi.string().guid({ version: 'uuidv4' }).required(),
    nombre: Joi.string().trim().max(150).required(),
    descripcion: Joi.string().allow(null, '').max(1000),
    tipo: Joi.string().valid('PREVENTIVO', 'RUTINARIO', 'CORRECTIVO', 'PREDICTIVO', 'ADECUACION', 'OTRO').default('PREVENTIVO'),
    periodicidadValor: Joi.number().integer().positive().required(),
    periodicidadUnidad: Joi.string().valid('DIAS', 'HORAS', 'KILOMETROS', 'HOROMETRO', 'MESES').required(),
    estado: Joi.boolean().default(true),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const updatePlanSchema = Joi.object({
  body: Joi.object({
    equipoUuid: Joi.string().guid({ version: 'uuidv4' }),
    nombre: Joi.string().trim().max(150),
    descripcion: Joi.string().allow(null, '').max(1000),
    tipo: Joi.string().valid('PREVENTIVO', 'RUTINARIO', 'CORRECTIVO', 'PREDICTIVO', 'ADECUACION', 'OTRO'),
    periodicidadValor: Joi.number().integer().positive(),
    periodicidadUnidad: Joi.string().valid('DIAS', 'HORAS', 'KILOMETROS', 'HOROMETRO', 'MESES'),
    estado: Joi.boolean(),
  }).min(1),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const getPlanSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const listPlanSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50),
    equipoUuid: Joi.string().guid({ version: 'uuidv4' }),
    tipo: Joi.string().valid('PREVENTIVO', 'RUTINARIO', 'CORRECTIVO', 'PREDICTIVO', 'ADECUACION', 'OTRO'),
    estado: Joi.boolean(),
    search: Joi.string().allow('', null),
  }),
});
