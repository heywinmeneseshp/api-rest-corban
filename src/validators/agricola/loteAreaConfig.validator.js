import Joi from 'joi';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();

export const listLoteAreaConfigSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
  }),
});

export const createLoteAreaConfigSchema = Joi.object({
  body: Joi.object({
    fincaUuid: Joi.string().guid({ version: 'uuidv4' }).required(),
    rolId: Joi.number().integer().positive().required(),
    fechaObjetivo: Joi.date().raw().required(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const toggleLoteAreaConfigSchema = Joi.object({
  body: Joi.object({
    activo: Joi.boolean().required(),
  }),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const removeLoteAreaConfigSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const registrarAreaLoteSchema = Joi.object({
  body: Joi.object({
    registros: Joi.array()
      .items(
        Joi.object({
          loteUuid: Joi.string().guid({ version: 'uuidv4' }).required(),
          areaTotal: Joi.number().positive().precision(2).required(),
          areaProduccion: Joi.number().positive().precision(2).required(),
        }),
      )
      .min(1)
      .required(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});
