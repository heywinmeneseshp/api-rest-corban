import Joi from 'joi';
import { CATEGORIAS_CAPA } from '../../database/models/fincaCapaMapa.model.js';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();
const par = Joi.array().length(2).items(Joi.number().min(-180).max(180)).required();

const elemento = Joi.object({
  nombre: Joi.string().max(150).allow('', null),
  subtipo: Joi.string().max(40).allow('', null),
  loteUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null),
  geometria: Joi.string().valid('POLIGONO', 'LINEA', 'PUNTO').required(),
  // Polígono ≥3 puntos, línea ≥2, punto = un solo par.
  coordenadas: Joi.when('geometria', {
    is: 'POLIGONO',
    then: Joi.array().items(par).min(3).max(5000).required(),
    otherwise: Joi.when('geometria', {
      is: 'LINEA',
      then: Joi.array().items(par).min(2).max(5000).required(),
      otherwise: par,
    }),
  }),
});

export const listCapasSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({ categoria: Joi.string().valid(...CATEGORIAS_CAPA) }),
});

export const reemplazarCapasSchema = Joi.object({
  body: Joi.object({
    categoria: Joi.string().valid(...CATEGORIAS_CAPA).required(),
    // Vacío = limpia la categoría.
    elementos: Joi.array().items(elemento).max(2000).required(),
  }),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const borrarCapasSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({ categoria: Joi.string().valid(...CATEGORIAS_CAPA).required() }),
});
