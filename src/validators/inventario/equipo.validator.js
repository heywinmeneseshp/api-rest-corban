import Joi from 'joi';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();

export const createEquipoSchema = Joi.object({
  body: Joi.object({
    codigo: Joi.string().trim().max(50).required(),
    nombre: Joi.string().trim().max(150).required(),
    descripcion: Joi.string().allow(null, '').max(1000),
    tipo: Joi.string().valid('TRACTOR', 'VEHICULO', 'MAQUINARIA', 'EQUIPO', 'BOMBA', 'OTRO').default('OTRO'),
    marca: Joi.string().trim().max(100).allow(null, ''),
    modelo: Joi.string().trim().max(100).allow(null, ''),
    serie: Joi.string().trim().max(100).allow(null, ''),
    fechaAdquisicion: Joi.date().iso().allow(null, ''),
    ubicacionUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null, ''),
    centroCostoUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null, ''),
    estado: Joi.string().valid('OPERATIVO', 'MANTENIMIENTO', 'FUERA_SERVICIO', 'INACTIVO', 'DE_BAJA').default('OPERATIVO'),
    horometro: Joi.number().min(0).default(0),
    kilometraje: Joi.number().min(0).default(0),
    responsableUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null, ''),
    observaciones: Joi.string().allow(null, '').max(1000),
    repuestosUuids: Joi.array().items(Joi.string().guid({ version: 'uuidv4' })).allow(null),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const updateEquipoSchema = Joi.object({
  body: Joi.object({
    codigo: Joi.string().trim().max(50),
    nombre: Joi.string().trim().max(150),
    descripcion: Joi.string().allow(null, '').max(1000),
    tipo: Joi.string().valid('TRACTOR', 'VEHICULO', 'MAQUINARIA', 'EQUIPO', 'BOMBA', 'OTRO'),
    marca: Joi.string().trim().max(100).allow(null, ''),
    modelo: Joi.string().trim().max(100).allow(null, ''),
    serie: Joi.string().trim().max(100).allow(null, ''),
    fechaAdquisicion: Joi.date().iso().allow(null, ''),
    ubicacionUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null, ''),
    centroCostoUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null, ''),
    estado: Joi.string().valid('OPERATIVO', 'MANTENIMIENTO', 'FUERA_SERVICIO', 'INACTIVO', 'DE_BAJA'),
    horometro: Joi.number().min(0),
    kilometraje: Joi.number().min(0),
    responsableUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null, ''),
    observaciones: Joi.string().allow(null, '').max(1000),
    repuestosUuids: Joi.array().items(Joi.string().guid({ version: 'uuidv4' })).allow(null),
  }).min(1),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const getEquipoSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const listEquipoSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50),
    search: Joi.string().allow('', null),
    tipo: Joi.string().valid('TRACTOR', 'VEHICULO', 'MAQUINARIA', 'EQUIPO', 'BOMBA', 'OTRO'),
    estado: Joi.string().valid('OPERATIVO', 'MANTENIMIENTO', 'FUERA_SERVICIO', 'INACTIVO', 'DE_BAJA'),
    ubicacionUuid: Joi.string().guid({ version: 'uuidv4' }),
    centroCostoUuid: Joi.string().guid({ version: 'uuidv4' }),
  }),
});

export const addComponenteSchema = Joi.object({
  body: Joi.object({
    productoUuid: Joi.string().guid({ version: 'uuidv4' }).required(),
    notas: Joi.string().allow(null, '').max(500),
  }),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const removeComponenteSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam, productoUuid: Joi.string().guid({ version: 'uuidv4' }).required() }),
  query: Joi.object({}),
});
