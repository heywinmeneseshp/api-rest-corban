import Joi from 'joi';

const uuid = Joi.string().guid({ version: 'uuidv4' });
const vacio = Joi.object({});

export const iniciarRecorridoSchema = Joi.object({
  body: Joi.object({ uuid: uuid.required(), fincaUuid: uuid.required(), inicio: Joi.date().iso().required() }),
  params: vacio,
  query: vacio,
});

export const cerrarRecorridoSchema = Joi.object({
  body: Joi.object({ fin: Joi.date().iso().required() }),
  params: Joi.object({ uuid: uuid.required() }),
  query: vacio,
});

export const puntosRecorridoSchema = Joi.object({
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
  params: Joi.object({ uuid: uuid.required() }),
  query: vacio,
});

export const listarRecorridosSchema = Joi.object({
  body: vacio,
  params: vacio,
  query: Joi.object({
    fecha: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/),
    fincaUuid: uuid,
    usuarioUuid: uuid,
  }),
});

export const getPuntosRecorridoSchema = Joi.object({ body: vacio, params: Joi.object({ uuid: uuid.required() }), query: vacio });
