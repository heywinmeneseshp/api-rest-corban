import Joi from 'joi';

const uuid = Joi.string().guid({ version: 'uuidv4' });
const uuidReq = uuid.required();
const vacio = { body: Joi.object({}), params: Joi.object({}), query: Joi.object({}) };

const secciones = Joi.array()
  .items(Joi.object({ seccion: Joi.string().trim().max(200).required(), items: Joi.array().items(Joi.string().trim().max(1000)).min(1).max(200).required() }))
  .min(1)
  .max(40);

export const crearPlantillaSchema = Joi.object({
  ...vacio,
  body: Joi.object({ nombre: Joi.string().trim().min(2).max(150).required(), descripcion: Joi.string().trim().max(1000).allow('', null), estado: Joi.boolean(), secciones: secciones.required() }),
});
export const actualizarPlantillaSchema = Joi.object({
  ...vacio,
  params: Joi.object({ uuid: uuidReq }),
  body: Joi.object({ nombre: Joi.string().trim().min(2).max(150), descripcion: Joi.string().trim().max(1000).allow('', null), estado: Joi.boolean(), secciones }).min(1),
});
export const plantillaUuidSchema = Joi.object({ ...vacio, params: Joi.object({ uuid: uuidReq }) });

export const generarChecklistSchema = Joi.object({ ...vacio, params: Joi.object({ uuid: uuidReq }), body: Joi.object({ plantillaUuid: uuid }) });
export const guardarChecklistSchema = Joi.object({
  ...vacio,
  params: Joi.object({ uuid: uuidReq }),
  body: Joi.object({
    items: Joi.array()
      .items(Joi.object({ uuid: uuidReq, calificacion: Joi.string().valid('SATISFACTORIO', 'OBSERVACION', 'INSATISFACTORIO', 'NA', 'PENDIENTE'), observaciones: Joi.string().trim().max(3000).allow('', null) }).or('calificacion', 'observaciones'))
      .min(1)
      .max(300)
      .required(),
  }),
});

const hallazgo = {
  descripcion: Joi.string().trim().max(3000),
  calificacion: Joi.string().valid('OBSERVACION', 'INSATISFACTORIO'),
  accionEjecutada: Joi.string().trim().max(3000).allow('', null),
  pendienteRepuesto: Joi.string().trim().max(3000).allow('', null),
  recomendacion: Joi.string().trim().max(3000).allow('', null),
  prioridad: Joi.string().valid('BAJA', 'MEDIA', 'ALTA', 'CRITICA'),
};
export const crearHallazgoSchema = Joi.object({ ...vacio, params: Joi.object({ uuid: uuidReq }), body: Joi.object({ ...hallazgo, descripcion: hallazgo.descripcion.required() }) });
export const actualizarHallazgoSchema = Joi.object({
  ...vacio,
  params: Joi.object({ hUuid: uuidReq }),
  body: Joi.object({ ...hallazgo, estado: Joi.string().valid('ABIERTO', 'EN_SEGUIMIENTO', 'RESUELTO') }).min(1),
});
export const hallazgoUuidSchema = Joi.object({ ...vacio, params: Joi.object({ hUuid: uuidReq }) });
export const programarHallazgoSchema = Joi.object({
  ...vacio,
  params: Joi.object({ hUuid: uuidReq }),
  body: Joi.object({ fecha: Joi.date().iso(), prioridad: Joi.string().valid('BAJA', 'MEDIA', 'ALTA', 'CRITICA') }),
});
export const hallazgosEquipoSchema = Joi.object({
  ...vacio,
  params: Joi.object({ uuid: uuidReq }),
  query: Joi.object({ estado: Joi.string().valid('ABIERTO', 'EN_SEGUIMIENTO', 'RESUELTO') }),
});
