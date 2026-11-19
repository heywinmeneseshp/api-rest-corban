import { Router } from 'express';
import Joi from 'joi';
import { auth } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { pushService } from '../../services/sistema/push.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

// Token de notificaciones push del celular del usuario (app móvil).
const router = Router();
const token = Joi.string().trim().min(10).max(255).required();
const esquema = (body) => Joi.object({ body: Joi.object(body), params: Joi.object({}), query: Joi.object({}) });

router.post(
  '/token',
  auth,
  validate(esquema({ token, plataforma: Joi.string().valid('android', 'ios').allow(null, '') })),
  asyncHandler(async (req, res) => {
    ApiResponse.send(res, { message: 'Notificaciones registradas', data: await pushService.registrarToken(req.user.id, req.body) });
  }),
);
router.put(
  '/token/activo',
  auth,
  validate(esquema({ token, activo: Joi.boolean().required() })),
  asyncHandler(async (req, res) => {
    ApiResponse.send(res, { message: 'Preferencia guardada', data: await pushService.cambiarActivo(req.user.id, req.body.token, req.body.activo) });
  }),
);
router.post(
  '/token/quitar',
  auth,
  validate(esquema({ token })),
  asyncHandler(async (req, res) => {
    await pushService.quitarToken(req.body.token);
    ApiResponse.send(res, { message: 'Notificaciones desactivadas en este celular', data: null });
  }),
);

export default router;
