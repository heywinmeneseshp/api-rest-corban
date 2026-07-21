import Joi from 'joi';

export const resetDatosSchema = Joi.object({
  body: Joi.object({
    confirmacion: Joi.string().required(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});
