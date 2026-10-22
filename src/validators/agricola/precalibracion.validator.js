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

// Sesión a la que pertenece un racimo: el celular la genera al iniciar y la manda en cada registro (sirve offline).
const sesionPayload = Joi.object({
  uuid: Joi.string().guid({ version: 'uuidv4' }).required(),
  tipo: Joi.string().valid('VIGENTE', 'ANTICIPADA').required(),
  inicio: Joi.date().iso(),
});

export const cerrarSesionPrecalibracionSchema = Joi.object({
  body: Joi.object({ fin: Joi.date().iso() }),
  params: Joi.object({ uuid: Joi.string().guid({ version: 'uuidv4' }).required() }),
  query: Joi.object({}),
});

export const trazaSesionPrecalibracionSchema = Joi.object({
  body: Joi.object({
    puntos: Joi.array()
      .items(
        Joi.object({
          lat: Joi.number().min(-90).max(90).required(),
          lng: Joi.number().min(-180).max(180).required(),
          t: Joi.date().iso().required(),
          precision: Joi.number().min(0).allow(null),
        }),
      )
      .min(1)
      .max(2000)
      .required(),
  }),
  params: Joi.object({ uuid: Joi.string().guid({ version: 'uuidv4' }).required() }),
  query: Joi.object({}),
});

export const getTrazaSesionPrecalibracionSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: Joi.string().guid({ version: 'uuidv4' }).required() }),
  query: Joi.object({}),
});

export const rendimientoPrecalibracionSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    semanaUuid: Joi.string().guid({ version: 'uuidv4' }),
    fincaUuid: Joi.string().guid({ version: 'uuidv4' }),
  }),
});

// Carga manual desde Excel: el archivo se lee en la web y llega como filas (una por lote y día) con los racimos aptos por edad.
export const importarPrecalibracionSchema = Joi.object({
  body: Joi.object({
    simular: Joi.boolean().default(false),
    filas: Joi.array()
      .items(
        Joi.object({
          fila: Joi.number().integer().min(1),
          fecha: Joi.string().allow('', null),
          finca: Joi.string().allow('', null),
          lote: Joi.alternatives(Joi.string(), Joi.number()).allow('', null),
          modalidad: Joi.string().allow('', null),
          calibrador: Joi.alternatives(Joi.string(), Joi.number()).allow('', null),
          horaInicio: Joi.string().allow('', null),
          horaFin: Joi.string().allow('', null),
          edades: Joi.object().pattern(/^\d{1,2}$/, Joi.number().integer().min(0).max(20000)).default({}),
        }),
      )
      .min(1)
      .max(500)
      .required(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const semanalPrecalibracionSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    fincaUuid: Joi.string().guid({ version: 'uuidv4' }),
    tipo: Joi.string().valid('VIGENTE', 'ANTICIPADA'),
  }),
});

export const sesionesPrecalibracionSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    fincaUuid: Joi.string().guid({ version: 'uuidv4' }),
    loteUuid: Joi.string().guid({ version: 'uuidv4' }),
    semanaUuid: Joi.string().guid({ version: 'uuidv4' }),
    tipo: Joi.string().valid('VIGENTE', 'ANTICIPADA'),
    fechaDesde: Joi.date().iso(),
    fechaHasta: Joi.date().iso(),
  }),
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
          sesion: sesionPayload,
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
    segundosEspera: Joi.number().integer().min(0).max(120).default(10),
    modalidad: Joi.string().valid('VIGENTE', 'ANTICIPADA').default('VIGENTE'),
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
