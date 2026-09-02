import Joi from 'joi';

const crearBodySchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        fincaUuid: Joi.string().uuid().required(),
        semanaUuid: Joi.string().uuid().required(),
        cajas20kg: Joi.number().min(0).max(1000000).required(),
      }),
    )
    .min(1)
    .required(),
});

const listQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  fincaUuid: Joi.string().uuid(),
  // Filtra por quien cargó la estimación (solo tiene efecto para admin).
  usuarioUuid: Joi.string().uuid(),
});

// Devuelve las próximas `semanas` a estimar (empezando la semana siguiente
// a la actual) y la tasa de conversión aplicada a las cajas.
const semanasQuerySchema = Joi.object({
  semanas: Joi.number().integer().min(1).max(53).default(8),
});

const uuidParamSchema = Joi.object({
  uuid: Joi.string().uuid().required(),
});

export const listarEstimacionesSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: listQuerySchema,
});

export const guardarEstimacionesSchema = Joi.object({
  body: crearBodySchema,
  params: Joi.object({}),
  query: Joi.object({}),
});

export const obtenerSemanasSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: semanasQuerySchema,
});

export const eliminarEstimacionSchema = Joi.object({
  body: Joi.object({}),
  params: uuidParamSchema,
  query: Joi.object({}),
});

const escaleraQuerySchema = Joi.object({
  fincaUuid: Joi.string().uuid(),
  usuarioUuid: Joi.string().uuid(),
});

export const obtenerEscaleraSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: escaleraQuerySchema,
});

// Mismos filtros que la escalera (finca puntual, usuario si sos admin).
const comparativoQuerySchema = Joi.object({
  fincaUuid: Joi.string().uuid(),
  usuarioUuid: Joi.string().uuid(),
});

export const obtenerComparativoSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: comparativoQuerySchema,
});

export default {
  listarEstimacionesSchema,
  guardarEstimacionesSchema,
  obtenerSemanasSchema,
  eliminarEstimacionSchema,
  obtenerEscaleraSchema,
  obtenerComparativoSchema,
};
