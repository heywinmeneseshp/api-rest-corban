import { Router } from 'express';
import { climaController } from '../../controllers/agricola/clima.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { uploadBulkFile } from '../../middlewares/upload.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';

const router = Router();

router.get('/', auth, climaController.list);
router.post('/', auth, climaController.create);

// Serie para el gráfico de Clima — mismo criterio que el list de arriba,
// abierto a cualquier usuario autenticado, sin permiso puntual.
router.get('/promedio-semanal', auth, climaController.promedioSemanal);

// A diferencia del registro individual (arriba), el cargue masivo por
// archivo sí exige un permiso puntual — es una acción de oficina/admin, no
// algo que cualquier usuario de la app móvil haga.
router.post('/bulk-upload', auth, permission(PERMISSIONS.CLIMA_CREAR), uploadBulkFile, climaController.bulkUpload);

export default router;
