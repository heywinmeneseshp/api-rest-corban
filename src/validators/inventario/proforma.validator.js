import Joi from 'joi';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();

const detalleSchema = Joi.object({
  productoUuid: Joi.string().guid({ version: 'uuidv4' }).required(),
  cantidad: Joi.number().positive().required(),
  precioUnitario: Joi.number().min(0).required().label('precioUnitario'),
  precio: Joi.number().min(0).label('precio'),
  descuento: Joi.number().min(0).default(0),
  observaciones: Joi.string().allow(null, '').max(500),
}).custom((value, helpers) => {
  // Allow alias "precio" as precioUnitario
  if (value.precio !== undefined && value.precioUnitario === undefined) {
    value.precioUnitario = value.precio;
  }
  if (value.precioUnitario === undefined) {
    return helpers.error('any.required');
  }
  return value;
});

export const createProformaSchema = Joi.object({
  body: Joi.object({
    cliente: Joi.string().trim().max(200).required(),
    clienteIdentificacion: Joi.string().trim().max(50).allow(null, ''),
    clienteEmail: Joi.string().email().allow(null, ''),
    fecha: Joi.date().iso().required(),
    fechaVigencia: Joi.date().iso().allow(null, ''),
    vigencia: Joi.date().iso().allow(null, ''),
    descuento: Joi.number().min(0).default(0),
    impuestos: Joi.number().min(0).default(0),
    estado: Joi.string().valid('BORRADOR', 'APROBADA', 'ENVIADA', 'CONVERTIDA', 'VENCIDA', 'CANCELADA').default('BORRADOR'),
    observaciones: Joi.string().allow(null, '').max(1000),
    detalles: Joi.array().items(detalleSchema).min(1).required(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const updateProformaSchema = Joi.object({
  body: Joi.object({
    cliente: Joi.string().trim().max(200),
    clienteIdentificacion: Joi.string().trim().max(50).allow(null, ''),
    clienteEmail: Joi.string().email().allow(null, ''),
    fecha: Joi.date().iso(),
    fechaVigencia: Joi.date().iso().allow(null, ''),
    vigencia: Joi.date().iso().allow(null, ''),
    descuento: Joi.number().min(0),
    impuestos: Joi.number().min(0),
    estado: Joi.string().valid('BORRADOR', 'APROBADA', 'ENVIADA', 'CONVERTIDA', 'VENCIDA', 'CANCELADA'),
    observaciones: Joi.string().allow(null, '').max(1000),
    detalles: Joi.array().items(detalleSchema).min(1),
  }).min(1),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const getProformaSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const listProformaSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50),
    search: Joi.string().allow('', null),
    estado: Joi.string().valid('BORRADOR', 'APROBADA', 'ENVIADA', 'CONVERTIDA', 'VENCIDA', 'CANCELADA'),
    fechaDesde: Joi.date().iso(),
    fechaHasta: Joi.date().iso(),
  }),
});

export const convertirProformaSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});
