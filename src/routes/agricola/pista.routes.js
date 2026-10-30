import { Router } from 'express';
import Joi from 'joi';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { pistaService } from '../../services/agricola/pista.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

const router = Router();
const uuidRef = Joi.string().guid({ version: 'uuidv4' });
const vacio = { body: Joi.object({}), params: Joi.object({}), query: Joi.object({}) };
const campos = {
  nombre: Joi.string().trim().min(2).max(120),
  correos: Joi.array().items(Joi.string().trim().email()).max(50),
  observaciones: Joi.string().trim().max(300).allow('', null),
  responsable: Joi.string().trim().max(150).allow('', null),
  telefono: Joi.string().trim().max(40).allow('', null),
  estado: Joi.boolean(),
};

/**
 * @openapi
 * /pistas:
 *   get:
 *     tags: [Pistas]
 *     summary: Pistas de aviación (de dónde sale la aspersión aérea) con sus correos para el aviso
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
// Lectura (lista y última de una finca): basta con tener sesión; la usa el formulario de Programación de Aspersiones.
router.get(
  '/',
  auth,
  validate(Joi.object({ ...vacio, query: Joi.object({ activas: Joi.boolean() }) })),
  asyncHandler(async (req, res) => {
    ApiResponse.send(res, { message: 'Pistas obtenidas correctamente', data: await pistaService.listar(req.query) });
  }),
);
router.get(
  '/ultima',
  auth,
  validate(Joi.object({ ...vacio, query: Joi.object({ fincaUuid: uuidRef.required() }) })),
  asyncHandler(async (req, res) => {
    ApiResponse.send(res, { message: 'Última pista de la finca', data: await pistaService.ultimaDeFinca(req.query.fincaUuid) });
  }),
);
router.post(
  '/',
  auth,
  permission(PERMISSIONS.PISTA_CREAR),
  validate(Joi.object({ ...vacio, body: Joi.object({ ...campos, nombre: campos.nombre.required() }) })),
  asyncHandler(async (req, res) => {
    ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Pista creada correctamente', data: await pistaService.crear(req.body, req.user?.id) });
  }),
);
router.put(
  '/:uuid',
  auth,
  permission(PERMISSIONS.PISTA_EDITAR),
  validate(Joi.object({ ...vacio, body: Joi.object(campos).min(1), params: Joi.object({ uuid: uuidRef.required() }) })),
  asyncHandler(async (req, res) => {
    ApiResponse.send(res, { message: 'Pista actualizada correctamente', data: await pistaService.actualizar(req.params.uuid, req.body, req.user?.id) });
  }),
);
router.delete(
  '/:uuid',
  auth,
  permission(PERMISSIONS.PISTA_ELIMINAR),
  validate(Joi.object({ ...vacio, params: Joi.object({ uuid: uuidRef.required() }) })),
  asyncHandler(async (req, res) => {
    await pistaService.eliminar(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Pista eliminada correctamente', data: {} });
  }),
);

export default router;
