import Joi from 'joi';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();
const uuidRef = Joi.string().guid({ version: 'uuidv4' });
const UUID_V4 = '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
// Una o varias fincas separadas por coma (comparación entre fincas: se
// suman en una sola línea) — mismo criterio que clima.service.js.
const uuidListRef = Joi.string().pattern(new RegExp(`^${UUID_V4}(,${UUID_V4})*$`, 'i'));

export const listEvaluacionesSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    fechaDesde: Joi.date().iso().raw(),
    fechaHasta: Joi.date().iso().raw(),
    fincaUuid: uuidRef,
    loteUuid: uuidRef,
    semanaUuid: uuidRef,
    usuarioUuid: uuidRef,
    tipoEvaluacionUuid: uuidRef,
  }),
});

export const getEvaluacionSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const promedioPorSemanaSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    fincaUuid: uuidListRef,
    anio: Joi.number().integer().min(2000).max(2100),
  }),
});

export const indicadoresSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    semanaUuid: uuidRef,
    fincaUuid: uuidRef,
    usuarioUuid: uuidRef,
    loteUuid: uuidRef,
    anio: Joi.number().integer().min(2000).max(2100),
  }),
});

export const createEvaluacionSchema = Joi.object({
  body: Joi.object({
    plantaUuid: uuidRef.required(),
    tipoEvaluacionUuid: uuidRef.required(),
    semanaUuid: uuidRef.required(),
    usuarioUuid: uuidRef,
    fecha: Joi.date().iso().raw().required(),
    // Hora local real de captura (app móvil) — opcional, para no romper
    // clientes viejos ni la creación manual desde el panel web.
    capturadoEn: Joi.date().iso(),
    observacion: Joi.string().max(2000).allow('', null),
    estado: Joi.boolean(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const updateEvaluacionSchema = Joi.object({
  body: Joi.object({
    plantaUuid: uuidRef,
    tipoEvaluacionUuid: uuidRef,
    semanaUuid: uuidRef,
    usuarioUuid: uuidRef,
    fecha: Joi.date().iso().raw(),
    observacion: Joi.string().max(2000).allow('', null),
    estado: Joi.boolean(),
  }).min(1),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const listObjetivosSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    fincaUuid: uuidRef,
    loteUuid: uuidRef,
    tipoEvaluacionUuid: uuidRef,
  }),
});

export const getObjetivoSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const createObjetivoSchema = Joi.object({
  body: Joi.object({
    tipoEvaluacionUuid: uuidRef.required(),
    fincaUuid: uuidRef,
    loteUuid: uuidRef,
    cantidad: Joi.number().integer().min(1).required(),
    edadMinima: Joi.number().integer().min(1).allow(null),
    edadMaxima: Joi.number().integer().min(1).allow(null),
    estado: Joi.boolean(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const updateObjetivoSchema = Joi.object({
  body: Joi.object({
    tipoEvaluacionUuid: uuidRef,
    fincaUuid: uuidRef.allow(null),
    loteUuid: uuidRef.allow(null),
    cantidad: Joi.number().integer().min(1),
    edadMinima: Joi.number().integer().min(1).allow(null),
    edadMaxima: Joi.number().integer().min(1).allow(null),
    estado: Joi.boolean(),
  }).min(1),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const setSbHojaUmbralesSchema = Joi.object({
  body: Joi.object({
    advertencia: Joi.number().min(0).required(),
    alerta: Joi.number().min(0).required(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const progresoObjetivosSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    fincaUuid: uuidRef,
    loteUuid: uuidRef,
    semanaUuid: uuidRef,
  }),
});
