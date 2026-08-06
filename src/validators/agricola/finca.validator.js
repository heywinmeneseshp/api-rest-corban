import Joi from 'joi';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();

export const listFincasSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    search: Joi.string().allow('').max(150),
  }),
});

export const getFincaSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const listFincaLotesSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    // Solo tiene efecto si el usuario es Administrador — el service lo
    // ignora en silencio para cualquier otro rol.
    incluirEliminados: Joi.boolean(),
    // Opt-in: trae también los lotes de las fincas hermanas de Grupo de
    // Finca. Por defecto false para no romper la sincronización de la app
    // móvil, que asume que esta respuesta nunca trae lotes de otra finca.
    incluirGrupo: Joi.boolean(),
  }),
});

export const createFincaSchema = Joi.object({
  body: Joi.object({
    codigo: Joi.string().min(1).max(20).required(),
    nombre: Joi.string().min(2).max(150).required(),
    estado: Joi.boolean(),
    grupoFincaUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const updateFincaSchema = Joi.object({
  body: Joi.object({
    codigo: Joi.string().min(1).max(20),
    nombre: Joi.string().min(2).max(150),
    estado: Joi.boolean(),
    grupoFincaUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null),
  }).min(1),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const syncBanaricaSchema = Joi.object({
  body: Joi.object({
    consecutivos: Joi.array().items(Joi.string()).min(1).required(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});
