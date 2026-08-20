import { Router } from 'express';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { laborCulturalController } from '../../controllers/agricola/laborCultural.controller.js';
import { uploadFotosLabor } from '../../middlewares/upload.middleware.js';

const router = Router();

// list/create: usados por la app móvil para registrar visitas, sin permiso
// dedicado (cualquier usuario autenticado puede enviar sus evaluaciones).
router.get('/', auth, laborCulturalController.list);
router.post('/', auth, laborCulturalController.create);
// Fotos de la visita (Google Drive) — mismo criterio sin permiso dedicado,
// las sube el mismo evaluador que ya registró la visita.
router.post('/visitas/:visitaUuid/fotos', auth, uploadFotosLabor, laborCulturalController.agregarFotos);
// visitas/*: reporte de consulta en app-corbana (Sanidad Vegetal › Evaluación
// de Labores), sí requiere permiso propio para poder asignarlo por rol.
router.get('/visitas', auth, permission(PERMISSIONS.LABOR_EVALUACION_VER), laborCulturalController.listVisitas);
router.get(
  '/visitas/:visitaUuid',
  auth,
  permission(PERMISSIONS.LABOR_EVALUACION_VER),
  laborCulturalController.getVisita,
);

export default router;
