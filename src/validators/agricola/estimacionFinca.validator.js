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
  anio: Joi.number().integer().min(2000).max(2100),
});

export const obtenerEscaleraSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: escaleraQuerySchema,
});

// Mismos filtros que la escalera (finca puntual, usuario si sos admin, año).
const comparativoQuerySchema = Joi.object({
  fincaUuid: Joi.string().uuid(),
  usuarioUuid: Joi.string().uuid(),
  anio: Joi.number().integer().min(2000).max(2100),
});

export const obtenerComparativoSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: comparativoQuerySchema,
});

export const exportarComparativoSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: comparativoQuerySchema,
});

const resumenFincaQuerySchema = Joi.object({
  fincaUuid: Joi.string().uuid().required(),
});

export const obtenerResumenFincaSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: resumenFincaQuerySchema,
});

const liquidacionBodySchema = Joi.object({
  fincaUuid: Joi.string().uuid().required(),
  semanaUuid: Joi.string().uuid().required(),
});

export const liquidarSemanaSchema = Joi.object({
  body: liquidacionBodySchema,
  params: Joi.object({}),
  query: Joi.object({}),
});

export const quitarLiquidacionSemanaSchema = Joi.object({
  body: liquidacionBodySchema,
  params: Joi.object({}),
  query: Joi.object({}),
});

export const liquidarSemanasMasivoSchema = Joi.object({
  body: Joi.object({
    semanaHastaUuid: Joi.string().uuid().required(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

const guardarPatronCortePctBodySchema = Joi.object({
  fincaUuid: Joi.string().uuid().required(),
  porcentajes: Joi.object().pattern(Joi.string(), Joi.number().min(0).max(100).allow(null)).allow(null).required(),
});

export const guardarPatronCortePctSchema = Joi.object({
  body: guardarPatronCortePctBodySchema,
  params: Joi.object({}),
  query: Joi.object({}),
});

const guardarRatioCajasPorSemanaBodySchema = Joi.object({
  fincaUuid: Joi.string().uuid().required(),
  ratios: Joi.object().pattern(Joi.string(), Joi.number().min(0).allow(null)).allow(null).required(),
});

export const guardarRatioCajasPorSemanaSchema = Joi.object({
  body: guardarRatioCajasPorSemanaBodySchema,
  params: Joi.object({}),
  query: Joi.object({}),
});

export default {
  listarEstimacionesSchema,
  guardarEstimacionesSchema,
  obtenerSemanasSchema,
  eliminarEstimacionSchema,
  obtenerEscaleraSchema,
  obtenerComparativoSchema,
  exportarComparativoSchema,
  obtenerResumenFincaSchema,
  liquidarSemanaSchema,
  quitarLiquidacionSemanaSchema,
  liquidarSemanasMasivoSchema,
  guardarPatronCortePctSchema,
  guardarRatioCajasPorSemanaSchema,
};
