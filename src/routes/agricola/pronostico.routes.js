import { Router } from 'express';
import { pronosticoController } from '../../controllers/agricola/pronostico.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { proyeccionService } from '../../services/agricola/proyeccion.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { getPronosticoSchema, exportarPronosticoSchema, guardarRatioManualSchema, guardarCajasAdicionalesSchema, guardarProductosSemanalSchema } from '../../validators/agricola/pronostico.validator.js';

const router = Router();

/**
 * @openapi
 * /pronostico:
 *   get:
 *     tags: [Pronóstico]
 *     summary: Pronóstico de cajas por finca y semana (racimos → ratio → cajas 20kg)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get('/', auth, permission(PERMISSIONS.PRONOSTICO_VER), validate(getPronosticoSchema), pronosticoController.get);

/**
 * @openapi
 * /pronostico/exportar:
 *   get:
 *     tags: [Pronóstico]
 *     summary: Exportar el pronóstico de cajas a Excel con los filtros actuales
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Archivo Excel }
 */
router.get(
  '/exportar',
  auth,
  permission(PERMISSIONS.PRONOSTICO_VER),
  validate(exportarPronosticoSchema),
  pronosticoController.exportar,
);

// Ratio editado a mano en la proyección semanal (se guarda para todos). Quien edita escenarios de proyección.
// Reparto de cajas por producto de la proyección semanal (propio, o el del escenario anual si no hay propio).
router.get('/productos', auth, permission(PERMISSIONS.PRONOSTICO_VER), asyncHandler(async (req, res) => {
  ApiResponse.send(res, { message: 'Reparto por producto', data: await proyeccionService.productosSemanal() });
}));
router.put('/productos', auth, permission(PERMISSIONS.PROYECCION_EDITAR), validate(guardarProductosSemanalSchema), asyncHandler(async (req, res) => {
  ApiResponse.send(res, { message: 'Reparto por producto guardado', data: await proyeccionService.guardarProductosSemanal(req.body.productos, req.user?.id) });
}));
router.delete('/productos', auth, permission(PERMISSIONS.PROYECCION_EDITAR), asyncHandler(async (req, res) => {
  ApiResponse.send(res, { message: 'Se usa el reparto del escenario anual', data: await proyeccionService.restablecerProductosSemanal(req.user?.id) });
}));
router.put('/cajas-proyectada', auth, permission(PERMISSIONS.PROYECCION_EDITAR), validate(guardarCajasAdicionalesSchema), pronosticoController.guardarCajasProyectada);
router.put('/cajas-adicionales', auth, permission(PERMISSIONS.PROYECCION_EDITAR), validate(guardarCajasAdicionalesSchema), pronosticoController.guardarCajasAdicionales);
router.put('/ratio-manual', auth, permission(PERMISSIONS.PROYECCION_EDITAR), validate(guardarRatioManualSchema), pronosticoController.guardarRatioManual);

export default router;
