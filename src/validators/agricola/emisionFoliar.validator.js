import Joi from 'joi';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();
const uuidRef = Joi.string().guid({ version: 'uuidv4' });

// Candela es una fracción (ej. 0.80), no un conteo — misma regla que Suma
// Bruta: valores >= 1 casi siempre son un error de tipeo.
const candela = Joi.number().min(0).less(1).precision(2);

export const getEmisionSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const createEmisionSchema = Joi.object({
  body: Joi.object({
    hojasTotales: Joi.number().integer().min(0).required(),
    candela,
  }),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const updateEmisionSchema = Joi.object({
  body: Joi.object({
    hojasTotales: Joi.number().integer().min(0),
    candela,
    estado: Joi.boolean(),
  }).min(1),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

// Seguimiento: todas las plantas evaluadas, filtrables por finca/lote/planta
// y rango de semanas (o año).
export const seguimientoEmisionSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    fincaUuid: uuidRef,
    loteUuid: uuidRef,
    plantaUuid: uuidRef,
    anio: Joi.number().integer().min(2000).max(2100),
  }),
});
