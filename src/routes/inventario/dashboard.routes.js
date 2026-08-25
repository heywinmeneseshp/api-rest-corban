import { Router } from 'express';
import { dashboardController } from '../../controllers/inventario/dashboard.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';

const router = Router();

router.get('/resumen', auth, permission(PERMISSIONS.INVENTARIO_DASHBOARD_VER), dashboardController.resumen);

export default router;
