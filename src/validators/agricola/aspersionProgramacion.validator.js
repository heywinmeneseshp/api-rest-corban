import Joi from 'joi';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();
const TIPOS = ['SIGATOKA_NEGRA', 'DEFOLIADOR', 'FERTILIZACION'];

export const createAspersionSchema = Joi.object({
  body: Joi.object({
    fincaUuid: Joi.string().guid({ version: 'uuidv4' }).required(),
    fecha: Joi.date().iso().required(),
    // Array: el aviso permite marcar más de una casilla a la vez (Sigatoka
    // Negra + Defoliador, por ejemplo).
    tipo: Joi.array().items(Joi.string().valid(...TIPOS)).min(1).required(),
    mezclaUuid: Joi.string().guid({ version: 'uuidv4' }).required(),
    almacenUuid: Joi.string().guid({ version: 'uuidv4' }).required(),
    // Con qué se hace la aspersión — selección única (Avión o Dron).
    medio: Joi.string().valid('AVION', 'DRON').required(),
    hectareas: Joi.number().positive().required(),
    // Se sugiere sola (dosis × hectáreas) pero el operador la puede
    // corregir a mano antes de guardar — ver aspersionProgramacion.service.js.
    cantidad: Joi.number().positive(),
    // Ajuste puntual por insumo, opcional — si un artículo no viene acá,
    // esa línea nace con el valor calculado de la receta (ver
    // aspersionProgramacion.service.js#create).
    componentes: Joi.array().items(
      Joi.object({
        articuloUuid: Joi.string().guid({ version: 'uuidv4' }).required(),
        cantidad: Joi.number().positive().required(),
      }),
    ),
    representanteCorbanaNombre: Joi.string().trim().max(150).allow(null, ''),
    administradorFincaNombre: Joi.string().trim().max(150).allow(null, ''),
    observaciones: Joi.string().allow(null, '').max(1000),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const updateAspersionSchema = Joi.object({
  body: Joi.object({
    fincaUuid: Joi.string().guid({ version: 'uuidv4' }),
    fecha: Joi.date().iso(),
    tipo: Joi.array().items(Joi.string().valid(...TIPOS)).min(1),
    mezclaUuid: Joi.string().guid({ version: 'uuidv4' }),
    almacenUuid: Joi.string().guid({ version: 'uuidv4' }),
    medio: Joi.string().valid('AVION', 'DRON'),
    hectareas: Joi.number().positive(),
    cantidad: Joi.number().positive(),
    componentes: Joi.array().items(
      Joi.object({
        articuloUuid: Joi.string().guid({ version: 'uuidv4' }).required(),
        cantidad: Joi.number().positive().required(),
      }),
    ),
    representanteCorbanaNombre: Joi.string().trim().max(150).allow(null, ''),
    administradorFincaNombre: Joi.string().trim().max(150).allow(null, ''),
    observaciones: Joi.string().allow(null, '').max(1000),
  }).min(1),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const getAspersionSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const listAspersionSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({}),
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50),
    fincaUuid: Joi.string().guid({ version: 'uuidv4' }),
    semanaUuid: Joi.string().guid({ version: 'uuidv4' }),
    mezclaUuid: Joi.string().guid({ version: 'uuidv4' }),
    estado: Joi.string().valid('PROGRAMADA', 'EJECUTADA', 'CANCELADA'),
    tipo: Joi.string().valid(...TIPOS),
    fechaDesde: Joi.date().iso(),
    fechaHasta: Joi.date().iso(),
    search: Joi.string().allow('', null),
  }),
});

export const ejecutarAspersionSchema = Joi.object({
  body: Joi.object({
    // true solo en el reenvío tras confirmar la advertencia de stock
    // insuficiente (ver aspersionProgramacion.service.js#ejecutar).
    forzarSaldoNegativo: Joi.boolean().default(false),
    // Datos del modal de ejecutar: con ellos se crea el comprobante de
    // aplicación en borrador (ver comprobanteAspersion.service.js). Todo
    // opcional — se pueden completar después en el comprobante.
    comprobante: Joi.object({
      piloto: Joi.string().trim().max(150).allow(null, ''),
      hectareasAplicadas: Joi.number().positive(),
      galonesTotales: Joi.number().min(0),
      observaciones: Joi.string().allow(null, '').max(1000),
      // Datos de la aplicación (todos opcionales): aeronave, volumen por
      // hectárea (gal/ha), clima y horario (HH:MM).
      // Ejecución parcial: fecha en que se hará la parte restante (por defecto, el día siguiente).
      fechaParteRestante: Joi.date().iso(),
      // Esta aspersión es del mismo ciclo que otra de la MISMA finca (aplicación en varios días).
      cicloConAspersionUuid: Joi.string().guid({ version: 'uuidv4' }),
      aeronave: Joi.string().trim().max(150).allow(null, ''),
      volumenAplicacionHa: Joi.number().min(0).allow(null),
      temperaturaInicial: Joi.number().min(-10).max(60).allow(null),
      temperaturaFinal: Joi.number().min(-10).max(60).allow(null),
      velocidadViento: Joi.number().min(0).allow(null),
      humedadRelativaFinal: Joi.number().min(0).max(100).allow(null),
      horaInicio: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/).allow(null, ''),
      horaFinal: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/).allow(null, ''),
    }),
  }),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const actualizarComponenteAspersionSchema = Joi.object({
  body: Joi.object({
    cantidad: Joi.number().positive().required(),
  }),
  params: Joi.object({ uuid: uuidParam, componenteUuid: Joi.string().guid({ version: 'uuidv4' }).required() }),
  query: Joi.object({}),
});

export const unirCicloSchema = Joi.object({
  body: Joi.object({ aspersionUuid: Joi.string().guid({ version: 'uuidv4' }).required() }),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const listUsuariosFincaSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ fincaUuid: uuidParam }),
  query: Joi.object({}),
});

export const enviarCorreoAspersionSchema = Joi.object({
  body: Joi.object({
    // multipart/form-data: llega como string, separado por comas.
    destinatarios: Joi.string().trim().required(),
  }),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});
