import Joi from 'joi';

export const crearConfigSchema = Joi.object({
  body: Joi.object({
    fincaUuid: Joi.string().uuid().required(),
    rolId: Joi.number().integer().required(),
    semanaInicioUuid: Joi.string().uuid().required(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const toggleConfigSchema = Joi.object({
  body: Joi.object({
    activo: Joi.boolean().required(),
  }),
  params: Joi.object({
    uuid: Joi.string().uuid().required(),
  }),
  query: Joi.object({}),
});

export const uuidParamSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({
    uuid: Joi.string().uuid().required(),
  }),
  query: Joi.object({}),
});

export const resolverInconsistenciaSchema = Joi.object({
  body: Joi.object({
    fuente: Joi.string().valid('precipitacion_diaria', 'clima').required(),
  }),
  params: Joi.object({
    uuid: Joi.string().uuid().required(),
  }),
  query: Joi.object({}),
});

export const registrarSchema = Joi.object({
  body: Joi.object({
    registros: Joi.array()
      .items(
        Joi.object({
          fincaUuid: Joi.string().uuid().required(),
          fecha: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
          mm: Joi.number().min(0).required(),
        }),
      )
      .min(1)
      .required(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});
