import Joi from 'joi';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();
const uuidRef = Joi.string().guid({ version: 'uuidv4' });

const TIPOS = ['EMBOLSE', 'REPIQUE', 'RECUSE', 'PROCESADO'];

export const listRacimoMovimientosSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1),
    // Tope alto a propósito: la tabla de Movimientos permite subir el
    // límite de la página para poder seleccionar y eliminar en bloque
    // varias filas a la vez, sin tener que ir página por página.
    limit: Joi.number().integer().min(1).max(500),
    fincaUuid: uuidRef,
    loteUuid: uuidRef,
    semanaEmbolseUuid: uuidRef,
    semanaRegistroUuid: uuidRef,
    semanaRegistroDesdeUuid: uuidRef,
    semanaRegistroHastaUuid: uuidRef,
    usuarioUuid: uuidRef,
    tipo: Joi.string().valid(...TIPOS),
    fechaDesde: Joi.date().iso().raw(),
    fechaHasta: Joi.date().iso().raw(),
  }),
});

export const getRacimoMovimientoSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const deleteRacimoMovimientosEnLoteSchema = Joi.object({
  body: Joi.object({
    uuids: Joi.array().items(uuidRef).min(1).max(500).required(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const createRacimoMovimientoSchema = Joi.object({
  body: Joi.object({
    fincaUuid: uuidRef.required(),
    loteUuid: uuidRef.required(),
    semanaEmbolseUuid: uuidRef.required(),
    semanaRegistroUuid: uuidRef,
    tipo: Joi.string().valid(...TIPOS).required(),
    motivoRepiqueUuid: uuidRef,
    motivoRecuseUuid: uuidRef,
    cantidad: Joi.number().integer().min(1).required(),
    fecha: Joi.date().iso().raw().required(),
    observacion: Joi.string().max(255).allow('', null),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const createRacimoMovimientosEnLoteSchema = Joi.object({
  body: Joi.object({
    fincaUuid: uuidRef.required(),
    semanaRegistroUuid: uuidRef.required(),
    fecha: Joi.date().iso().raw().required(),
    forzarSaldoNegativo: Joi.boolean().default(false),
    movimientos: Joi.array()
      .items(
        Joi.object({
          tipo: Joi.string().valid(...TIPOS).required(),
          loteUuid: uuidRef.required(),
          semanaEmbolseUuid: uuidRef.required(),
          motivoRepiqueUuid: uuidRef,
          motivoRecuseUuid: uuidRef,
          cantidad: Joi.number().integer().min(1).required(),
          observacion: Joi.string().max(255).allow('', null),
        }),
      )
      .min(1)
      .required(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const resumenCohorteSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    fincaUuid: uuidRef.required(),
    loteUuid: uuidRef.required(),
    semanaEmbolseUuid: uuidRef.required(),
  }),
});

export const reporteSaldosSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    fincaUuid: uuidRef,
    anio: Joi.number().integer().min(2000).max(2100),
    cantidadSemanas: Joi.number().integer().min(1).max(53).default(13),
  }),
});

export const reporteEmbolsesSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    fincaUuid: uuidRef,
    anio: Joi.number().integer().min(2000).max(2100),
    anios: Joi.string(),
  }),
});

export const exportarMovimientosSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    fincaUuid: uuidRef,
    loteUuid: uuidRef,
    semanaEmbolseUuid: uuidRef,
    semanaRegistroDesdeUuid: uuidRef,
    semanaRegistroHastaUuid: uuidRef,
    usuarioUuid: uuidRef,
    tipo: Joi.string().valid(...TIPOS),
    fechaDesde: Joi.date().iso().raw(),
    fechaHasta: Joi.date().iso().raw(),
  }),
});

export const exportarReporteSemanalSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    semanaUuid: uuidRef.required(),
    tipo: Joi.string().valid(...TIPOS).required(),
  }),
});

export const inventarioRacimosSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    fincaUuid: uuidRef,
    loteUuid: uuidRef,
    semanaActualUuid: uuidRef,
    cantidadSemanas: Joi.number().integer().min(1).max(53),
  }),
});
