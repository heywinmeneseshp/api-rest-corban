import Joi from 'joi';

export const updateBanaricaUrlSchema = Joi.object({
  body: Joi.object({
    url: Joi.string().uri({ scheme: ['http', 'https'] }).max(255).required(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});
