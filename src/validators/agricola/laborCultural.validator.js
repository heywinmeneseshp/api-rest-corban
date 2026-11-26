import Joi from 'joi';

// Aprobación desde la tablet con el usuario y la contraseña de quien revisa.
export const revisarConCredencialesSchema = Joi.object({
  body: Joi.object({
    usuario: Joi.string().trim().max(100).required(),
    password: Joi.string().max(200).required(),
  }),
  params: Joi.object({
    visitaUuid: Joi.string().uuid().required(),
  }),
  query: Joi.object({}),
});

export const visitaUuidParamSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({
    visitaUuid: Joi.string().uuid().required(),
  }),
  query: Joi.object({}),
});

export const crearRolRevisorSchema = Joi.object({
  body: Joi.object({
    rolId: Joi.number().integer().required(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const toggleRolRevisorSchema = Joi.object({
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

export const revisorCcSchema = Joi.object({
  body: Joi.object({
    correos: Joi.array().items(Joi.string().email()).max(20).default([]),
    rolesUuids: Joi.array().items(Joi.string().uuid()).max(20).default([]),
    usuariosUuids: Joi.array().items(Joi.string().uuid()).max(50).default([]),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});
