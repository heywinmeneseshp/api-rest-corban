import Joi from 'joi';
import { MENU_ITEM_TIPOS } from '../../database/models/menuItem.model.js';

const uuidParam = Joi.string().guid({ version: 'uuidv4' }).required();

export const getMenuItemSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});

export const createMenuItemSchema = Joi.object({
  body: Joi.object({
    nombre: Joi.string().min(2).max(100).required(),
    tipo: Joi.string()
      .valid(...MENU_ITEM_TIPOS)
      .required(),
    parentUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null),
    ruta: Joi.string().max(255).allow('', null),
    icono: Joi.string().max(100).allow('', null),
    orden: Joi.number().integer().min(0),
    permisoUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

export const updateMenuItemSchema = Joi.object({
  body: Joi.object({
    nombre: Joi.string().min(2).max(100),
    tipo: Joi.string().valid(...MENU_ITEM_TIPOS),
    parentUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null),
    ruta: Joi.string().max(255).allow('', null),
    icono: Joi.string().max(100).allow('', null),
    orden: Joi.number().integer().min(0),
    permisoUuid: Joi.string().guid({ version: 'uuidv4' }).allow(null),
  }).min(1),
  params: Joi.object({ uuid: uuidParam }),
  query: Joi.object({}),
});
