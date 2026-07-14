import Joi from 'joi';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();
const uuidRef = Joi.string().guid({ version: 'uuidv4' });

export const getConteoSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const createConteoSchema = Joi.object({
  body: Joi.object({
    semanaEmbolseUuid: uuidRef.required(),
    hojasFuncionales: Joi.number().integer().min(0).required(),
  }),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const updateConteoSchema = Joi.object({
  body: Joi.object({
    semanaEmbolseUuid: uuidRef,
    hojasFuncionales: Joi.number().integer().min(0),
    estado: Joi.boolean(),
  }).min(1),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});
