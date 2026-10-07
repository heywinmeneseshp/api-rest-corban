import Joi from 'joi';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();

export const listLoteAreaConfigSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
  }),
});

export const createLoteAreaConfigSchema = Joi.object({
  body: Joi.object({
    fincaUuid: Joi.string().guid({ version: 'uuidv4' }).required(),
    rolId: Joi.number().integer().positive().required(),
    fechaObjetivo: Joi.date().raw().required(),
    recurrencia: Joi.string().valid('UNA_VEZ', 'SEMANAL', 'QUINCENAL', 'MENSUAL').default('UNA_VEZ'),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const toggleLoteAreaConfigSchema = Joi.object({
  body: Joi.object({
    activo: Joi.boolean().required(),
  }),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const removeLoteAreaConfigSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const registrarAreaLoteSchema = Joi.object({
  body: Joi.object({
    registros: Joi.array()
      .items(
        Joi.object({
          loteUuid: Joi.string().guid({ version: 'uuidv4' }).required(),
          areaTotal: Joi.number().positive().precision(2).required(),
          // 0 es válido: lote sin área en producción por ahora.
          areaProduccion: Joi.number().min(0).precision(2).required(),
        }),
      )
      .min(1)
      .required(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const removeLotePendienteSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ loteUuid: uuidParam }),
  query: Joi.object({}),
});

// Nombre numérico como en el maestro de lotes (ver
// lote.validator.js#nombreLote): el código se genera solo.
export const createLotePendienteSchema = Joi.object({
  body: Joi.object({
    fincaUuid: Joi.string().guid({ version: 'uuidv4' }).required(),
    nombre: Joi.string()
      .pattern(/^\d+$/)
      .max(150)
      .required()
      .messages({ 'string.pattern.base': 'El nombre del lote debe contener solo números (ej: 01, 02).' }),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const listSolicitudesSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({ estado: Joi.string().valid('PENDIENTE', 'APROBADA', 'RECHAZADA', 'TODAS') }),
});

export const resolverSolicitudSchema = Joi.object({
  body: Joi.object({ motivo: Joi.string().max(300).allow('', null) }),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});
