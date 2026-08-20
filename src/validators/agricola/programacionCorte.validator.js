import Joi from 'joi';

export const syncBanaricaProgramacionSchema = Joi.object({
  body: Joi.object({
    // Obligatoria: evita traer y reprocesar todo el histórico de Logística
    // en cada sincronización (cargues/recargues masivos accidentales).
    semanaUuid: Joi.string().guid({ version: 'uuidv4' }).required(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

// Webhook llamado por api-rest-banarica — la semana viaja como código
// (ej. "S34-2026"), Banarica no conoce los uuids de Corbana.
export const webhookSyncProgramacionSchema = Joi.object({
  body: Joi.object({
    semana: Joi.string().required(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});
