import Joi from 'joi';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();

export const createEquipoSchema = Joi.object({
  body: Joi.object({
    codigo: Joi.string().trim().max(50).required(),
    nombre: Joi.string().trim().max(150).required(),
    descripcion: Joi.string().allow(null, '').max(1000),
    tipoUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null, ''),
    marca: Joi.string().trim().max(100).allow(null, ''),
    modelo: Joi.string().trim().max(100).allow(null, ''),
    serie: Joi.string().trim().max(100).allow(null, ''),
    configuracion: Joi.string().trim().max(300).allow(null, ''),
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
    tipoUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null, ''),
    marca: Joi.string().trim().max(100).allow(null, ''),
    modelo: Joi.string().trim().max(100).allow(null, ''),
    serie: Joi.string().trim().max(100).allow(null, ''),
    configuracion: Joi.string().trim().max(300).allow(null, ''),
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
    tipoUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null, ''),
    estado: Joi.string().valid('OPERATIVO', 'MANTENIMIENTO', 'FUERA_SERVICIO', 'INACTIVO', 'DE_BAJA'),
    ubicacionUuid: Joi.string().guid({ version: 'uuidv4' }),
    centroCostoUuid: Joi.string().guid({ version: 'uuidv4' }),
  }),
});

export const addComponenteSchema = Joi.object({
  body: Joi.object({
    articuloUuid: Joi.string().guid({ version: 'uuidv4' }).required(),
    notas: Joi.string().allow(null, '').max(500),
  }),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const removeComponenteSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam, articuloUuid: Joi.string().guid({ version: 'uuidv4' }).required() }),
  query: Joi.object({}),
});

// ─── Lecturas de kilometraje / horas ───
const lectura = {
  uuid: Joi.string().guid({ version: 'uuidv4' }),
  kilometraje: Joi.number().min(0).max(99999999),
  horometro: Joi.number().min(0).max(99999999),
  fechaHora: Joi.date().iso(),
  nota: Joi.string().trim().max(300).allow('', null),
  corregir: Joi.boolean(),
};
export const registrarLecturaSchema = Joi.object({
  body: Joi.object(lectura).or('kilometraje', 'horometro'),
  params: Joi.object({ uuid: Joi.string().guid({ version: 'uuidv4' }).required() }),
  query: Joi.object({}),
});
export const registrarLecturasLoteSchema = Joi.object({
  body: Joi.object({
    items: Joi.array()
      .items(Joi.object({ ...lectura, uuid: Joi.string().guid({ version: 'uuidv4' }).required(), equipoUuid: Joi.string().guid({ version: 'uuidv4' }).required() }).or('kilometraje', 'horometro'))
      .min(1)
      .max(200)
      .required(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});
export const historialLecturasSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: Joi.string().guid({ version: 'uuidv4' }).required() }),
  query: Joi.object({ limite: Joi.number().integer().min(1).max(500) }),
});

// ─── Partes y accesorios con serie (baterías, control remoto...) ───
const uuidReq = Joi.string().guid({ version: 'uuidv4' }).required();
const parte = {
  tipo: Joi.string().valid('BATERIA', 'CONTROL_REMOTO', 'CARGADOR', 'ANTENA', 'OTRO'),
  codigo: Joi.string().trim().max(60),
  serie: Joi.string().trim().max(100).allow('', null),
  descripcion: Joi.string().trim().max(200).allow('', null),
  estado: Joi.string().valid('ACTIVA', 'EN_REVISION', 'RETIRADA'),
  observaciones: Joi.string().trim().max(2000).allow('', null),
};
export const listarPartesSchema = Joi.object({ body: Joi.object({}), params: Joi.object({ uuid: uuidReq }), query: Joi.object({}) });
export const crearParteSchema = Joi.object({
  body: Joi.object({ ...parte, codigo: parte.codigo.required(), ciclos: Joi.number().min(0).max(100000) }),
  params: Joi.object({ uuid: uuidReq }),
  query: Joi.object({}),
});
export const actualizarParteSchema = Joi.object({ body: Joi.object(parte).min(1), params: Joi.object({ parteUuid: uuidReq }), query: Joi.object({}) });
export const parteUuidSchema = Joi.object({ body: Joi.object({}), params: Joi.object({ parteUuid: uuidReq }), query: Joi.object({}) });
export const registrarParteSchema = Joi.object({
  body: Joi.object({
    tipo: Joi.string().valid('CICLOS', 'NOVEDAD', 'MANTENIMIENTO', 'ASIGNACION').required(),
    ciclos: Joi.number().min(0).max(100000),
    descripcion: Joi.string().trim().max(2000).allow('', null),
    equipoUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null, ''),
    fechaHora: Joi.date().iso(),
  }),
  params: Joi.object({ parteUuid: uuidReq }),
  query: Joi.object({}),
});
