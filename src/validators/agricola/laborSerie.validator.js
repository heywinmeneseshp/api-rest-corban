import Joi from 'joi';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();
const uuidRef = Joi.string().guid({ version: 'uuidv4' });
const fechaIso = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/);
const horaStr = Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/);

export const getLaborSerieSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const createLaborSerieSchema = Joi.object({
  body: Joi.object({
    laborUuid: uuidRef.required(),
    fincaUuid: uuidRef.required(),
    modoLotes: Joi.string().valid('UNICO', 'ROTACION', 'SIMULTANEO').default('UNICO'),
    loteUuid: uuidRef.when('modoLotes', {
      is: 'UNICO',
      then: Joi.required(),
      otherwise: Joi.forbidden(),
    }),
    // El orden de loteUuids importa en modo ROTACION (define la secuencia).
    loteUuids: Joi.array()
      .items(uuidRef)
      .min(2)
      .when('modoLotes', {
        is: Joi.valid('ROTACION', 'SIMULTANEO'),
        then: Joi.required(),
        otherwise: Joi.forbidden(),
      }),
    fechaInicio: fechaIso.required(),
    hora: horaStr.allow(null, ''),
    duracionMinutos: Joi.number().integer().min(1).allow(null),
    numeroColaboradores: Joi.number().integer().min(1).allow(null),
    observaciones: Joi.string().max(500).allow('', null),
    esRecurrente: Joi.boolean().default(false),
    frecuencia: Joi.string()
      .valid('DIARIA', 'SEMANAL', 'MENSUAL', 'ANUAL')
      .when('esRecurrente', { is: true, then: Joi.required(), otherwise: Joi.forbidden() }),
    intervalo: Joi.number().integer().min(1).default(1),
    fechaFin: fechaIso.allow(null).when('esRecurrente', { is: false, then: Joi.forbidden() }),
    numRepeticiones: Joi.number()
      .integer()
      .min(1)
      .allow(null)
      .when('esRecurrente', { is: false, then: Joi.forbidden() }),
  }).custom((value, helpers) => {
    if (value.modoLotes !== 'UNICO' && !value.esRecurrente) {
      return helpers.message('Rotar entre lotes o programar varios lotes a la vez solo aplica a programaciones recurrentes');
    }
    return value;
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});
