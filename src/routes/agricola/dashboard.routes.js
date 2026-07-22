import { Router } from 'express';
import { dashboardController } from '../../controllers/agricola/dashboard.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';

const router = Router();

router.get('/resumen', auth, dashboardController.resumen);

export default router;
