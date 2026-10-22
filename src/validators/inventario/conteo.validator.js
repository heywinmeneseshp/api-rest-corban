import Joi from 'joi';

const uuid = Joi.string().guid({ version: 'uuidv4' });

export const listConteosSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    almacenUuid: uuid,
    estado: Joi.string().valid('BORRADOR', 'CERRADO', 'ANULADO'),
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(200),
  }),
});

export const getConteoSchema = Joi.object({
  body: Joi.object({}),
  query: Joi.object({}),
  params: Joi.object({ uuid: uuid.required() }),
});

export const createConteoSchema = Joi.object({
  body: Joi.object({
    almacenUuid: uuid.required(),
    categoriaUuid: uuid.allow(null),
    ciego: Joi.boolean().default(false),
    observaciones: Joi.string().trim().max(1000).allow('', null),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const guardarLineasConteoSchema = Joi.object({
  body: Joi.object({
    lineas: Joi.array()
      .items(
        Joi.object({
          articuloUuid: uuid.required(),
          cantidadContada: Joi.number().min(0).max(999999999).allow(null),
          observacion: Joi.string().trim().max(255).allow('', null),
        }),
      )
      .min(1)
      .max(2000)
      .required(),
  }),
  params: Joi.object({ uuid: uuid.required() }),
  query: Joi.object({}),
});

export const cerrarConteoSchema = Joi.object({
  body: Joi.object({
    motivoUuid: uuid.required(),
    observaciones: Joi.string().trim().max(1000).allow('', null),
  }),
  params: Joi.object({ uuid: uuid.required() }),
  query: Joi.object({}),
});

export const anularConteoSchema = getConteoSchema;
