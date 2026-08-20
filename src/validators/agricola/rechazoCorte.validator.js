import Joi from 'joi';

export const webhookSyncRechazoSchema = Joi.object({
  body: Joi.object({
    semana: Joi.string().required(),
    rechazos: Joi.array()
      .items(
        Joi.object({
          fechaRechazo: Joi.string().required(),
          // Fecha de llenado del contenedor = fecha real de cosecha. Puede
          // no venir si Logística no encontró el listado exacto.
          fechaLlenado: Joi.string().allow('', null),
          fincaCodigo: Joi.string().required(),
          productoNombre: Joi.string().allow('', null),
          cajas: Joi.number().required(),
          motivo: Joi.string().allow('', null),
        }),
      )
      .required(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const resumenRechazoSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    semanaUuid: Joi.string().guid({ version: 'uuidv4' }).required(),
  }),
});
