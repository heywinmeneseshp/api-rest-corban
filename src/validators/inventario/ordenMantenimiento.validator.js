import Joi from 'joi';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();

const detalleSchema = Joi.object({
  productoUuid: Joi.string().guid({ version: 'uuidv4' }).required(),
  cantidad: Joi.number().positive().required(),
  costoUnitario: Joi.number().min(0).default(0),
  almacenUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null, ''),
  observaciones: Joi.string().allow(null, '').max(500),
});

const manoObraSchema = Joi.object({
  descripcion: Joi.string().trim().max(500).required(),
  horas: Joi.number().min(0).default(0),
  costoHora: Joi.number().min(0).default(0),
  costoTotal: Joi.number().min(0).allow(null),
  responsableUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null, ''),
  observaciones: Joi.string().allow(null, '').max(500),
});

const servicioSchema = Joi.object({
  descripcion: Joi.string().trim().max(500).required(),
  proveedor: Joi.string().trim().max(150).allow(null, ''),
  costo: Joi.number().min(0).required(),
  observaciones: Joi.string().allow(null, '').max(500),
});

export const createOrdenSchema = Joi.object({
  body: Joi.object({
    equipoUuid: Joi.string().guid({ version: 'uuidv4' }).required(),
    planUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null, ''),
    programacionUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null, ''),
    tipo: Joi.string().valid('PREVENTIVO', 'CORRECTIVO', 'PREDICTIVO', 'OTRO').default('PREVENTIVO'),
    descripcion: Joi.string().trim().max(2000).required(),
    fecha: Joi.date().iso().required(),
    responsableUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null, ''),
    almacenUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null, ''),
    estado: Joi.string().valid('ABIERTA', 'EN_PROCESO', 'CERRADA', 'CANCELADA').default('ABIERTA'),
    prioridad: Joi.string().valid('BAJA', 'MEDIA', 'ALTA', 'CRITICA').default('MEDIA'),
    observaciones: Joi.string().allow(null, '').max(1000),
    detalles: Joi.array().items(detalleSchema).allow(null),
    manoObra: Joi.array().items(manoObraSchema).allow(null),
    servicios: Joi.array().items(servicioSchema).allow(null),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const updateOrdenSchema = Joi.object({
  body: Joi.object({
    equipoUuid: Joi.string().guid({ version: 'uuidv4' }),
    planUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null, ''),
    programacionUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null, ''),
    tipo: Joi.string().valid('PREVENTIVO', 'CORRECTIVO', 'PREDICTIVO', 'OTRO'),
    descripcion: Joi.string().trim().max(2000),
    fecha: Joi.date().iso(),
    fechaCierre: Joi.date().iso().allow(null, ''),
    responsableUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null, ''),
    almacenUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null, ''),
    estado: Joi.string().valid('ABIERTA', 'EN_PROCESO', 'CERRADA', 'CANCELADA'),
    prioridad: Joi.string().valid('BAJA', 'MEDIA', 'ALTA', 'CRITICA'),
    observaciones: Joi.string().allow(null, '').max(1000),
    detalles: Joi.array().items(detalleSchema).allow(null),
    manoObra: Joi.array().items(manoObraSchema).allow(null),
    servicios: Joi.array().items(servicioSchema).allow(null),
  }).min(1),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const getOrdenSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const listOrdenSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50),
    equipoUuid: Joi.string().guid({ version: 'uuidv4' }),
    planUuid: Joi.string().guid({ version: 'uuidv4' }),
    estado: Joi.string().valid('ABIERTA', 'EN_PROCESO', 'CERRADA', 'CANCELADA'),
    prioridad: Joi.string().valid('BAJA', 'MEDIA', 'ALTA', 'CRITICA'),
    tipo: Joi.string().valid('PREVENTIVO', 'CORRECTIVO', 'PREDICTIVO', 'OTRO'),
    fechaDesde: Joi.date().iso(),
    fechaHasta: Joi.date().iso(),
    search: Joi.string().allow('', null),
  }),
});

export const cerrarOrdenSchema = Joi.object({
  body: Joi.object({
    almacenUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null, ''),
    observaciones: Joi.string().allow(null, '').max(1000),
  }),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});
