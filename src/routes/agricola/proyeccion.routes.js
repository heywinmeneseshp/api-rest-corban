import { Router } from 'express';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { uploadBulkFile } from '../../middlewares/upload.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { proyeccionService } from '../../services/agricola/proyeccion.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';
import {
  listarEscenariosSchema,
  escenarioUuidSchema,
  crearEscenarioSchema,
  actualizarEscenarioSchema,
  guardarAreasSchema,
  guardarProductosSchema,
  resultadoSchema,
} from '../../validators/agricola/proyeccion.validator.js';

const router = Router();
const ver = [auth, permission(PERMISSIONS.PROYECCION_VER)];
const editar = [auth, permission(PERMISSIONS.PROYECCION_EDITAR)];

/**
 * @openapi
 * /proyeccion/escenarios:
 *   get:
 *     tags: [Proyección]
 *     summary: Escenarios de proyección anual
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   post:
 *     tags: [Proyección]
 *     summary: Crea un escenario (opcionalmente copiando otro)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Creado }
 */
router.get('/escenarios', ...ver, validate(listarEscenariosSchema), asyncHandler(async (req, res) => {
  ApiResponse.send(res, { message: 'Escenarios obtenidos correctamente', data: await proyeccionService.listarEscenarios(req.query) });
}));

router.post('/escenarios', ...editar, validate(crearEscenarioSchema), asyncHandler(async (req, res) => {
  const data = await proyeccionService.crearEscenario(req.body, req.user?.id);
  ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Escenario creado correctamente', data });
}));

/**
 * @openapi
 * /proyeccion/escenarios/{uuid}:
 *   get:
 *     tags: [Proyección]
 *     summary: Escenario con su plan de hectáreas nuevas
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   put:
 *     tags: [Proyección]
 *     summary: Actualiza nombre, descripción o parámetros del escenario
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   delete:
 *     tags: [Proyección]
 *     summary: Elimina el escenario
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get('/escenarios/:uuid', ...ver, validate(escenarioUuidSchema), asyncHandler(async (req, res) => {
  ApiResponse.send(res, { message: 'Escenario obtenido correctamente', data: await proyeccionService.getEscenario(req.params.uuid) });
}));

router.put('/escenarios/:uuid', ...editar, validate(actualizarEscenarioSchema), asyncHandler(async (req, res) => {
  const data = await proyeccionService.actualizarEscenario(req.params.uuid, req.body, req.user?.id);
  ApiResponse.send(res, { message: 'Escenario actualizado correctamente', data });
}));

router.delete('/escenarios/:uuid', ...editar, validate(escenarioUuidSchema), asyncHandler(async (req, res) => {
  await proyeccionService.eliminarEscenario(req.params.uuid, req.user?.id);
  ApiResponse.send(res, { message: 'Escenario eliminado correctamente', data: {} });
}));

/**
 * @openapi
 * /proyeccion/escenarios/{uuid}/areas:
 *   put:
 *     tags: [Proyección]
 *     summary: Reemplaza el plan de hectáreas nuevas (finca, semana de entrada, hectáreas)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.put('/escenarios/:uuid/areas', ...editar, validate(guardarAreasSchema), asyncHandler(async (req, res) => {
  const data = await proyeccionService.guardarAreas(req.params.uuid, req.body.areas, req.user?.id, req.user);
  ApiResponse.send(res, { message: 'Plan de hectáreas guardado correctamente', data });
}));

/**
 * @openapi
 * /proyeccion/escenarios/{uuid}/productos:
 *   put:
 *     tags: [Proyección]
 *     summary: Reemplaza los productos del reparto de cajas (producto y % de los kilos; deben sumar 100)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.put('/escenarios/:uuid/productos', ...editar, validate(guardarProductosSchema), asyncHandler(async (req, res) => {
  const data = await proyeccionService.guardarProductos(req.params.uuid, req.body.productos, req.user?.id);
  ApiResponse.send(res, { message: 'Productos del reparto guardados correctamente', data });
}));

/**
 * @openapi
 * /proyeccion/escenarios/{uuid}/areas-bulk:
 *   post:
 *     tags: [Proyección]
 *     summary: Carga masiva (Excel o CSV) del plan de hectáreas nuevas
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.post('/escenarios/:uuid/areas-bulk', ...editar, uploadBulkFile, validate(escenarioUuidSchema), asyncHandler(async (req, res) => {
  const dryRun = req.body?.dryRun === 'true';
  const data = await proyeccionService.cargarAreasMasivo(req.params.uuid, req.file, { dryRun }, req.user?.id, req.user);
  ApiResponse.send(res, { message: dryRun ? 'Validación de la carga de hectáreas' : 'Hectáreas cargadas correctamente', data });
}));

/**
 * @openapi
 * /proyeccion/escenarios/{uuid}/resultado:
 *   get:
 *     tags: [Proyección]
 *     summary: Calcula la proyección del escenario (por finca y semana, totales, aprovechamiento y comparativo)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get('/escenarios/:uuid/resultado', ...ver, validate(resultadoSchema), asyncHandler(async (req, res) => {
  ApiResponse.send(res, { message: 'Proyección calculada correctamente', data: await proyeccionService.resultado(req.params.uuid, req.query, req.user) });
}));

router.get('/escenarios/:uuid/exportar', ...ver, validate(resultadoSchema), asyncHandler(async (req, res) => {
  const { buffer, nombre } = await proyeccionService.exportarExcel(req.params.uuid, req.query, req.user);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${nombre}.xlsx"`);
  res.send(buffer);
}));

export default router;
