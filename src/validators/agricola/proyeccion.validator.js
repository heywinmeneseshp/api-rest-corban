import Joi from 'joi';

const uuid = Joi.string().guid({ version: 'uuidv4' });
const uuidParam = uuid.required();

const paramsSchema = Joi.object({
  rampaPct: Joi.number().min(0).max(100),
  rampaSemanas: Joi.number().integer().min(0).max(104),
  aniosHistoricos: Joi.number().integer().min(1).max(5),
  anios: Joi.array().items(Joi.number().integer().min(2000).max(2100)).max(6),
  hectareasBasePorFinca: Joi.object().pattern(uuid, Joi.number().min(0).max(100000).allow(null, '')),
  pctNoCosechado: Joi.number().min(0).max(90).allow(null, ''),
  pctNoCosechadoPorFinca: Joi.object().pattern(uuid, Joi.number().min(0).max(90).allow(null, '')),
});

const vacio = { body: Joi.object({}), params: Joi.object({}), query: Joi.object({}) };

export const listarEscenariosSchema = Joi.object({ ...vacio, query: Joi.object({ anio: Joi.number().integer().min(2000).max(2100) }) });

export const escenarioUuidSchema = Joi.object({ ...vacio, params: Joi.object({ uuid: uuidParam }) });

export const crearEscenarioSchema = Joi.object({
  ...vacio,
  body: Joi.object({
    nombre: Joi.string().min(2).max(120).required(),
    anio: Joi.number().integer().min(2000).max(2100).required(),
    descripcion: Joi.string().allow('', null).max(500),
    params: paramsSchema,
    copiarDeUuid: uuid,
  }),
});

export const actualizarEscenarioSchema = Joi.object({
  ...vacio,
  params: Joi.object({ uuid: uuidParam }),
  body: Joi.object({
    nombre: Joi.string().min(2).max(120),
    descripcion: Joi.string().allow('', null).max(500),
    params: paramsSchema,
  }).min(1),
});

export const guardarAreasSchema = Joi.object({
  ...vacio,
  params: Joi.object({ uuid: uuidParam }),
  body: Joi.object({
    areas: Joi.array()
      .items(
        Joi.object({
          fincaUuid: uuidParam,
          semanaUuid: uuidParam,
          hectareas: Joi.number().min(-10000).max(10000).required(),
          rampaPct: Joi.number().min(0).max(100).allow(null),
          rampaSemanas: Joi.number().integer().min(0).max(104).allow(null),
          nota: Joi.string().allow('', null).max(255),
        }),
      )
      .max(500)
      .required(),
  }),
});

export const resultadoSchema = Joi.object({
  ...vacio,
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({ fincaUuids: Joi.string() }),
});
