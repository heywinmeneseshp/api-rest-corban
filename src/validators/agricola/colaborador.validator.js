import Joi from 'joi';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();
const uuidRef = Joi.string().guid({ version: 'uuidv4' });

const laboresSchema = Joi.array().items(
  Joi.object({
    laborUuid: uuidRef.required(),
    calificacion: Joi.number().integer().min(1).max(5).required(),
  }),
);

export const listColaboradoresSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    search: Joi.string().allow('').max(150),
    fincaUuid: uuidRef,
    estado: Joi.boolean(),
  }),
});

export const getColaboradorSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const createColaboradorSchema = Joi.object({
  body: Joi.object({
    nombre: Joi.string().min(2).max(150).required(),
    apellido: Joi.string().allow('', null).max(150),
    documento: Joi.string().allow('', null).max(30),
    telefono: Joi.string().allow('', null).max(30),
    email: Joi.string().email().allow('', null).max(150),
    cargo: Joi.string().allow('', null).max(100),
    fincaUuid: uuidRef.allow(null),
    userUuid: uuidRef.allow(null),
    estado: Joi.boolean(),
    labores: laboresSchema,
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

// Ficha propia (autoservicio): queda vinculada al usuario de la sesión; nombre y apellido por defecto los del usuario.
export const crearMiFichaSchema = Joi.object({
  body: Joi.object({
    nombre: Joi.string().min(2).max(150).allow('', null),
    apellido: Joi.string().allow('', null).max(150),
    documento: Joi.string().min(3).max(30).required(),
    telefono: Joi.string().allow('', null).max(30),
    cargo: Joi.string().allow('', null).max(100),
    fincaUuid: uuidRef.allow(null),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const updateColaboradorSchema = Joi.object({
  body: Joi.object({
    nombre: Joi.string().min(2).max(150),
    apellido: Joi.string().allow('', null).max(150),
    documento: Joi.string().allow('', null).max(30),
    telefono: Joi.string().allow('', null).max(30),
    email: Joi.string().email().allow('', null).max(150),
    cargo: Joi.string().allow('', null).max(100),
    fincaUuid: uuidRef.allow(null),
    estado: Joi.boolean(),
    labores: laboresSchema,
  }).min(1),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const vincularUsuarioSchema = Joi.object({
  body: Joi.object({ userUuid: uuidRef.required() }),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

// Crea un usuario nuevo a partir del colaborador (nombre, apellido, correo y cargo salen de él).
export const crearUsuarioDeColaboradorSchema = Joi.object({
  body: Joi.object({
    usuario: Joi.string().alphanum().min(3).max(50).required(),
    password: Joi.string().min(8).max(100).pattern(/^(?=.*[A-Za-z])(?=.*\d).+$/, 'letras y números').required(),
    email: Joi.string().email().max(150),
  }),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});
