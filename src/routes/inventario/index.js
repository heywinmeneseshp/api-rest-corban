import { Router } from 'express';
import productoCategoriaRoutes from './productoCategoria.routes.js';
import unidadMedidaRoutes from './unidadMedida.routes.js';
import productoInventarioRoutes from './productoInventario.routes.js';
import almacenRoutes from './almacen.routes.js';

const router = Router();

router.use('/categorias', productoCategoriaRoutes);
router.use('/unidades', unidadMedidaRoutes);
router.use('/productos', productoInventarioRoutes);
router.use('/almacenes', almacenRoutes);

export default router;
