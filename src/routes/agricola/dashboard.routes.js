import { Router } from 'express';
import { dashboardController } from '../../controllers/agricola/dashboard.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { requireAdmin } from '../../middlewares/requireAdmin.middleware.js';
import { uploadPdfAspersion } from '../../middlewares/upload.middleware.js';

const router = Router();

router.get('/resumen', auth, dashboardController.resumen);
// Informe semanal de producción de una finca (?fincaUuid=&semanaUuid=).
router.get('/informe-semanal', auth, permission(PERMISSIONS.MENU_REPORTES), dashboardController.informeSemanal);
// Destinatarios del informe (solo Administrador) y envío manual con el PDF armado en el navegador (campo «pdf»).
router.get('/informe-semanal/destinatarios', auth, requireAdmin, dashboardController.getInformeSemanalDestinatarios);
router.put('/informe-semanal/destinatarios', auth, requireAdmin, dashboardController.updateInformeSemanalDestinatarios);
router.post('/informe-semanal/enviar', auth, permission(PERMISSIONS.MENU_REPORTES), uploadPdfAspersion, dashboardController.enviarInformeSemanal);

export default router;
