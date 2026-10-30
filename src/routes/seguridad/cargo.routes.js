import { Router } from 'express';
import Joi from 'joi';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { cargoService } from '../../services/seguridad/cargo.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

const router = Router();
const uuidRef = Joi.string().guid({ version: 'uuidv4' });
const vacio = { body: Joi.object({}), params: Joi.object({}), query: Joi.object({}) };
const campos = {
  nombre: Joi.string().trim().min(2).max(150),
  descripcion: Joi.string().trim().max(300).allow('', null),
  estado: Joi.boolean(),
};

/**
 * @openapi
 * /cargos:
 *   get:
 *     tags: [Cargos]
 *     summary: Maestro de cargos (etiquetas para usuarios y colaboradores), con cuántas personas tienen cada uno
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
// Lectura: basta con tener sesión (los formularios de usuarios, colaboradores y «mi ficha» eligen el cargo de esta lista).
router.get(
  '/',
  auth,
  validate(Joi.object({ ...vacio, query: Joi.object({ activos: Joi.boolean() }) })),
  asyncHandler(async (req, res) => {
    ApiResponse.send(res, { message: 'Cargos obtenidos correctamente', data: await cargoService.listar(req.query) });
  }),
);
router.post(
  '/',
  auth,
  permission(PERMISSIONS.CARGO_CREAR),
  validate(Joi.object({ ...vacio, body: Joi.object({ ...campos, nombre: campos.nombre.required() }) })),
  asyncHandler(async (req, res) => {
    ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Cargo creado correctamente', data: await cargoService.crear(req.body, req.user?.id) });
  }),
);
router.put(
  '/:uuid',
  auth,
  permission(PERMISSIONS.CARGO_EDITAR),
  validate(Joi.object({ ...vacio, body: Joi.object(campos).min(1), params: Joi.object({ uuid: uuidRef.required() }) })),
  asyncHandler(async (req, res) => {
    ApiResponse.send(res, { message: 'Cargo actualizado correctamente', data: await cargoService.actualizar(req.params.uuid, req.body, req.user?.id) });
  }),
);
router.delete(
  '/:uuid',
  auth,
  permission(PERMISSIONS.CARGO_ELIMINAR),
  // `?reemplazo=<uuid>`: las personas con este cargo pasan a ese otro antes de eliminarlo (fusionar).
  validate(Joi.object({ ...vacio, params: Joi.object({ uuid: uuidRef.required() }), query: Joi.object({ reemplazo: uuidRef }) })),
  asyncHandler(async (req, res) => {
    await cargoService.eliminar(req.params.uuid, req.user?.id, { reemplazoUuid: req.query.reemplazo || null });
    ApiResponse.send(res, { message: 'Cargo eliminado correctamente' });
  }),
);

export default router;
