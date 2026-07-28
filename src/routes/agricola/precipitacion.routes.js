import { Router } from 'express';
import { precipitacionController } from '../../controllers/agricola/precipitacion.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';

const router = Router();

router.get('/', auth, precipitacionController.list);
router.post('/', auth, precipitacionController.create);

export default router;
