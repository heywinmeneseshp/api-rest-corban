import { Router } from 'express';
import productoCategoriaRoutes from './productoCategoria.routes.js';
import unidadMedidaRoutes from './unidadMedida.routes.js';
import productoInventarioRoutes from './productoInventario.routes.js';
import almacenRoutes from './almacen.routes.js';
import motivoRoutes from './motivo.routes.js';
import movimientoRoutes from './movimiento.routes.js';

const router = Router();

router.use('/categorias', productoCategoriaRoutes);
router.use('/unidades', unidadMedidaRoutes);
router.use('/productos', productoInventarioRoutes);
router.use('/almacenes', almacenRoutes);
router.use('/motivos', motivoRoutes);
router.use('/movimientos', movimientoRoutes);

export default router;
