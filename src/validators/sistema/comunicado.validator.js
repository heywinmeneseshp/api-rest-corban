import Joi from 'joi';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();

export const enviarComunicadoSchema = Joi.object({
  body: Joi.object({
    asunto: Joi.string().trim().min(1).max(200).required(),
    mensaje: Joi.string().trim().min(1).max(5000).required(),
    correos: Joi.array().items(Joi.string().trim().email()).default([]),
    rolesUuids: Joi.array().items(Joi.string().guid({ version: 'uuidv4' })).default([]),
    usuariosUuids: Joi.array().items(Joi.string().guid({ version: 'uuidv4' })).default([]),
  })
    // Al menos una fuente de destinatarios tiene que traer algo — si no,
    // no hay a quién mandarle nada.
    .custom((value, helpers) => {
      const { correos, rolesUuids, usuariosUuids } = value;
      if (!correos.length && !rolesUuids.length && !usuariosUuids.length) {
        return helpers.message('Selecciona al menos un rol, usuario o correo manual');
      }
      return value;
    }, 'al menos un destinatario'),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const getComunicadoSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const listComunicadoSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    search: Joi.string().allow('', null),
  }),
});
