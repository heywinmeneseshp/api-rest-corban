import Joi from 'joi';

const uuidRef = Joi.string().guid({ version: 'uuidv4' });
// Vector facial: 128 números calculados en el dispositivo (no es una foto).
const descriptor = Joi.array().items(Joi.number()).length(128);

export const enrolarRostroSchema = Joi.object({
  body: Joi.object({
    muestras: Joi.array()
      .items(Joi.object({ pose: Joi.string().max(20).allow('', null), descriptor: descriptor.required() }))
      .min(1)
      .max(8)
      .required(),
    consentimiento: Joi.boolean().default(false),
    reforzar: Joi.boolean().default(false),
  }),
  params: Joi.object({ colaboradorUuid: uuidRef.required() }),
  query: Joi.object({}),
});

export const borrarRostroSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ colaboradorUuid: uuidRef.required() }),
  query: Joi.object({}),
});

export const rostrosEstadoSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({ fincaUuid: uuidRef }),
});

export const probarRostroSchema = Joi.object({
  body: Joi.object({ fincaUuid: uuidRef, descriptor: descriptor.required() }),
  params: Joi.object({}),
  query: Joi.object({}),
});

// Una marcación por elemento. El uuid lo genera el móvil (idempotencia ante reenvíos de la cola offline).
export const registrarMarcacionesSchema = Joi.object({
  body: Joi.object({
    marcaciones: Joi.array()
      .items(
        Joi.object({
          uuid: uuidRef.required(),
          fincaUuid: uuidRef.required(),
          tipo: Joi.string().valid('ENTRADA', 'SALIDA').required(),
          fechaHora: Joi.date().iso().required(),
          lat: Joi.number().min(-90).max(90).allow(null),
          lng: Joi.number().min(-180).max(180).allow(null),
          descriptor: descriptor.required(),
        }),
      )
      .min(1)
      .max(200)
      .required(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const listarAsistenciaSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(200),
    fincaUuid: uuidRef,
    colaboradorUuid: uuidRef,
    tipo: Joi.string().valid('ENTRADA', 'SALIDA'),
    desde: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/),
    hasta: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/),
  }),
});

export const jornadasAsistenciaSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(200),
    fincaUuid: uuidRef,
    colaboradorUuid: uuidRef,
    desde: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/),
    hasta: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/),
  }),
});

export const eliminarMarcacionSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidRef.required() }),
  query: Joi.object({}),
});
