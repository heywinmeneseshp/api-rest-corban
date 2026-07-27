import { Router } from 'express';
import { authController } from '../../controllers/seguridad/auth.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authRateLimiter } from '../../middlewares/rateLimiter.middleware.js';
import { loginSchema, refreshSchema, logoutSchema, updateProfileSchema, changePasswordSchema } from '../../validators/seguridad/auth.validator.js';

const router = Router();

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Iniciar sesión
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [usuario, password]
 *             properties:
 *               usuario: { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Credenciales inválidas }
 */
router.post('/login', authRateLimiter, validate(loginSchema), authController.login);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Renovar access token usando el refresh token
 *     responses:
 *       200: { description: OK }
 *       401: { description: Refresh token inválido o expirado }
 */
router.post('/refresh', authRateLimiter, validate(refreshSchema), authController.refresh);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Cerrar sesión (revoca el refresh token)
 *     responses:
 *       200: { description: OK }
 */
router.post('/logout', validate(logoutSchema), authController.logout);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Obtener el usuario autenticado
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get('/me', auth, authController.me);
router.put('/me', auth, validate(updateProfileSchema), authController.updateProfile);
router.put('/me/password', auth, validate(changePasswordSchema), authController.changePassword);

export default router;
