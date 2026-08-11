import Joi from 'joi';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();
const uuidRef = Joi.string().guid({ version: 'uuidv4' });

export const listLotesSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    search: Joi.string().allow('').max(150),
    fincaUuid: uuidRef,
  }),
});

export const getLoteSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const listLotePlantasSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
  }),
});

// El nombre del lote es siempre numérico (ej: "01", "02"), sin letras ni
// otros caracteres — así coincide con el número real del lote en campo.
const nombreLote = Joi.string()
  .pattern(/^\d+$/)
  .max(150)
  .messages({ 'string.pattern.base': 'El nombre del lote debe contener solo números (ej: 01, 02).' });

export const createLoteSchema = Joi.object({
  body: Joi.object({
    fincaUuid: uuidRef.required(),
    // El código se genera automáticamente ({codigoFinca}-{consecutivo}), pero
    // se acepta opcionalmente por si se quiere forzar uno específico.
    codigo: Joi.string().min(1).max(20),
    nombre: nombreLote.required(),
    area: Joi.number().positive().precision(2),
    estado: Joi.boolean(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const updateLoteSchema = Joi.object({
  body: Joi.object({
    fincaUuid: uuidRef,
    codigo: Joi.string().min(1).max(20),
    nombre: nombreLote,
    area: Joi.number().positive().precision(2),
    estado: Joi.boolean(),
  }).min(1),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const listAreaProduccionSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
  }),
});

export const createAreaProduccionSchema = Joi.object({
  body: Joi.object({
    area: Joi.number().positive().precision(2).required(),
    fecha: Joi.date().raw(),
  }),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});
