import { Router } from 'express';
import productoCategoriaRoutes from './productoCategoria.routes.js';
import unidadMedidaRoutes from './unidadMedida.routes.js';
import productoInventarioRoutes from './productoInventario.routes.js';
import almacenRoutes from './almacen.routes.js';
import motivoRoutes from './motivo.routes.js';
import movimientoRoutes from './movimiento.routes.js';
import mezclaRoutes from './mezcla.routes.js';
import elaboracionRoutes from './elaboracion.routes.js';
import proformaRoutes from './proforma.routes.js';
import equipoRoutes from './equipo.routes.js';
import proveedorRoutes from './proveedor.routes.js';
import planMantenimientoRoutes from './planMantenimiento.routes.js';
import programacionMantenimientoRoutes from './programacionMantenimiento.routes.js';
import ordenMantenimientoRoutes from './ordenMantenimiento.routes.js';
import dashboardRoutes from './dashboard.routes.js';

const router = Router();

router.use('/categorias', productoCategoriaRoutes);
router.use('/unidades', unidadMedidaRoutes);
router.use('/productos', productoInventarioRoutes);
router.use('/almacenes', almacenRoutes);
router.use('/motivos', motivoRoutes);
router.use('/movimientos', movimientoRoutes);
router.use('/mezclas', mezclaRoutes);
router.use('/elaboraciones', elaboracionRoutes);
router.use('/proformas', proformaRoutes);
router.use('/equipos', equipoRoutes);
router.use('/proveedores', proveedorRoutes);
router.use('/planes-mantenimiento', planMantenimientoRoutes);
router.use('/programaciones-mantenimiento', programacionMantenimientoRoutes);
router.use('/ordenes-mantenimiento', ordenMantenimientoRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;
