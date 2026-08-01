import { Router } from 'express';
import { auth } from '../../middlewares/auth.middleware.js';
import { laborCulturalController } from '../../controllers/agricola/laborCultural.controller.js';

const router = Router();

router.get('/', auth, laborCulturalController.list);
router.post('/', auth, laborCulturalController.create);
router.get('/visitas', auth, laborCulturalController.listVisitas);
router.get('/visitas/:visitaUuid', auth, laborCulturalController.getVisita);

export default router;
