import Joi from 'joi';

const uuidRef = Joi.string().guid({ version: 'uuidv4' });

const filtrosQuery = {
  fincaUuid: uuidRef,
  loteUuid: uuidRef,
  semanaUuid: uuidRef,
  valor: Joi.string().max(10),
  // Cinta: se filtra por la edad (la semana de embolse cambia con la semana de la precalibración).
  edad: Joi.number().integer().min(1).max(60),
};

export const opcionesPrecalibracionSchema = Joi.object({ body: Joi.object({}), params: Joi.object({}), query: Joi.object({}) });

export const resumenPrecalibracionSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object(filtrosQuery),
});

export const detalleLotePrecalibracionSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ loteUuid: uuidRef.required() }),
  query: Joi.object({ ...filtrosQuery, fincaUuid: Joi.any().strip(), loteUuid: Joi.any().strip() }),
});

// Un racimo apto por elemento. El uuid lo genera el móvil (idempotencia ante reenvíos de la cola offline).
export const registrarPrecalibracionSchema = Joi.object({
  body: Joi.object({
    registros: Joi.array()
      .items(
        Joi.object({
          uuid: uuidRef.required(),
          fincaUuid: uuidRef.required(),
          loteUuid: uuidRef.required(),
          semanaEmbolseUuid: uuidRef.required(),
          valor: Joi.alternatives(Joi.string().max(10), Joi.number()).required(),
          fechaHora: Joi.date().iso().required(),
          // Fecha local del dispositivo (YYYY-MM-DD). Opcional: si falta se deduce de fechaHora (hora de Colombia).
          fecha: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/),
          lat: Joi.number().min(-90).max(90).allow(null),
          lng: Joi.number().min(-180).max(180).allow(null),
        }),
      )
      .min(1)
      .max(1000)
      .required(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

// Ajuste de estimación hecho desde Precalibración (no modifica las estimaciones de la escalera).
export const guardarEstimacionPrecalibracionSchema = Joi.object({
  body: Joi.object({
    fincaUuid: uuidRef.required(),
    semanaUuid: uuidRef.required(),
    racimosAptos: Joi.number().integer().min(0).required(),
    cajas: Joi.number().integer().min(0).required(),
    ratio: Joi.number().min(0).max(100).allow(null),
    estimacionCajas: Joi.number().integer().min(0).allow(null),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

// Configuración: edades de cinta y valores del calibrador (global si no trae fincaUuid).
export const guardarConfigPrecalibracionSchema = Joi.object({
  body: Joi.object({
    fincaUuid: uuidRef.allow(null),
    // Solo se precalibran cintas de edad 8 a 12.
    edades: Joi.array().items(Joi.number().integer().min(8).max(12)).min(1).max(5).required(),
    valores: Joi.array().items(Joi.string().trim().max(10)).min(1).max(10).required(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const configPrecalibracionVaciaSchema = Joi.object({ body: Joi.object({}), params: Joi.object({}), query: Joi.object({}) });

export const restablecerConfigFincaSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ fincaUuid: uuidRef.required() }),
  query: Joi.object({}),
});
