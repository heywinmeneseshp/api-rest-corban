import { Router } from 'express';
import { climaController } from '../../controllers/agricola/clima.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';

const router = Router();

router.get('/', auth, climaController.list);
router.post('/', auth, climaController.create);

export default router;
