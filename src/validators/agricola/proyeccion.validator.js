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
  // Ratio (cajas por racimo) fijado a mano: { fincaUuid: { 'S12-2027': 0.0295 } } para semanas proyectadas.
  ratioManual: Joi.object().pattern(uuid, Joi.object().pattern(Joi.string().max(20), Joi.number().min(0.0001).max(5).allow(null, ''))),
  // Embolses por hectárea fijados a mano: { fincaUuid: { 'S46-2026': 150 } } para semanas proyectadas o con el embolse aún incompleto.
  embPorHaManual: Joi.object().pattern(uuid, Joi.object().pattern(Joi.string().max(20), Joi.number().min(0.1).max(5000).allow(null, ''))),
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

export const guardarProductosSchema = Joi.object({
  ...vacio,
  params: Joi.object({ uuid: uuidParam }),
  body: Joi.object({
    productos: Joi.array()
      .items(
        Joi.object({
          productoUuid: uuidParam,
          modo: Joi.string().valid('PORCENTAJE', 'CONTENEDORES', 'RESTO', 'FINCA').default('PORCENTAJE'),
          porcentaje: Joi.number().greater(0).max(100).allow(null),
          contenedores: Joi.number().greater(0).max(1000).allow(null),
          cajasContenedor: Joi.number().greater(0).max(100000).allow(null),
          cadaSemanas: Joi.number().integer().min(1).max(52).default(1),
          desdeSemana: Joi.number().integer().min(1).max(53).default(1),
          fincaUuids: Joi.when('modo', { is: 'FINCA', then: Joi.array().items(uuidParam).min(1).unique().required(), otherwise: Joi.any().strip() }),
        }),
      )
      .max(50)
      .required(),
  }),
});

export const resultadoSchema = Joi.object({
  ...vacio,
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({ fincaUuids: Joi.string() }),
});
