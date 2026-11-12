import { Router } from 'express';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { evaluacionRecorridoService } from '../../services/agricola/evaluacionRecorrido.service.js';
import {
  iniciarRecorridoSchema,
  cerrarRecorridoSchema,
  puntosRecorridoSchema,
  listarRecorridosSchema,
  getPuntosRecorridoSchema,
} from '../../validators/agricola/evaluacionRecorrido.validator.js';

// Recorrido (traza GPS) del evaluador. Se monta en /evaluaciones/recorridos, ANTES de las rutas de /evaluaciones/:uuid.
const router = Router();

router.post('/', auth, permission(PERMISSIONS.EVALUACION_CREAR), validate(iniciarRecorridoSchema), asyncHandler(async (req, res) => {
  const data = await evaluacionRecorridoService.iniciar(req.body, req.user);
  ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Recorrido iniciado', data });
}));
router.post('/:uuid/cerrar', auth, permission(PERMISSIONS.EVALUACION_CREAR), validate(cerrarRecorridoSchema), asyncHandler(async (req, res) => {
  const data = await evaluacionRecorridoService.cerrar(req.params.uuid, req.body, req.user);
  ApiResponse.send(res, { message: 'Recorrido cerrado', data });
}));
router.post('/:uuid/puntos', auth, permission(PERMISSIONS.EVALUACION_CREAR), validate(puntosRecorridoSchema), asyncHandler(async (req, res) => {
  const data = await evaluacionRecorridoService.subirPuntos(req.params.uuid, req.body.puntos, req.user);
  ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Puntos del recorrido recibidos', data });
}));
router.get('/', auth, permission(PERMISSIONS.EVALUACION_VER), validate(listarRecorridosSchema), asyncHandler(async (req, res) => {
  const data = await evaluacionRecorridoService.listar(req.query, req.user);
  ApiResponse.send(res, { message: 'Recorridos obtenidos correctamente', data });
}));
router.get('/:uuid/puntos', auth, permission(PERMISSIONS.EVALUACION_VER), validate(getPuntosRecorridoSchema), asyncHandler(async (req, res) => {
  const data = await evaluacionRecorridoService.puntos(req.params.uuid, req.user);
  ApiResponse.send(res, { message: 'Puntos del recorrido obtenidos correctamente', data });
}));

export default router;
