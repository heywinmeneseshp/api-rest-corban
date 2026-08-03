import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { env } from './config/env.config.js';
import { corsConfig } from './config/cors.config.js';
import { logger } from './utils/logger.js';
import { globalRateLimiter } from './middlewares/rateLimiter.middleware.js';
import { notFound } from './middlewares/notFound.middleware.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { swaggerSpec } from './docs/swagger.js';

import authRoutes from './routes/seguridad/auth.routes.js';
import userRoutes from './routes/seguridad/user.routes.js';
import roleRoutes from './routes/seguridad/role.routes.js';
import permisoRoutes from './routes/seguridad/permiso.routes.js';
import menuRoutes from './routes/seguridad/menuItem.routes.js';

import fincaRoutes from './routes/agricola/finca.routes.js';
import loteRoutes from './routes/agricola/lote.routes.js';
import plantaRoutes from './routes/agricola/planta.routes.js';
import categoriaPlantaRoutes from './routes/agricola/categoriaPlanta.routes.js';
import tipoEvaluacionRoutes from './routes/agricola/tipoEvaluacion.routes.js';
import semanaRoutes from './routes/agricola/semana.routes.js';
import evaluacionRoutes from './routes/agricola/evaluacion.routes.js';
import infeccionRoutes from './routes/agricola/infeccion.routes.js';
import conteoHojasRoutes from './routes/agricola/conteoHojas.routes.js';
import sumaBrutaRoutes from './routes/agricola/sumaBruta.routes.js';
import motivoRepiqueRoutes from './routes/agricola/motivoRepique.routes.js';
import motivoRecuseRoutes from './routes/agricola/motivoRecuse.routes.js';
import racimoMovimientoRoutes from './routes/agricola/racimoMovimiento.routes.js';
import produccionSemanalRoutes from './routes/agricola/produccionSemanal.routes.js';
import dashboardRoutes from './routes/agricola/dashboard.routes.js';
import laborCulturalRoutes from './routes/agricola/laborCultural.routes.js';
import climaRoutes from './routes/agricola/clima.routes.js';
import precipitacionDiariaRoutes from './routes/agricola/precipitacionDiaria.routes.js';

import configuracionRoutes from './routes/sistema/configuracion.routes.js';
import resetDatosRoutes from './routes/sistema/resetDatos.routes.js';
import setupRoutes from './routes/sistema/setup.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const app = express();

app.disable('x-powered-by');
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'script-src': ["'self'", "'unsafe-inline'", 'https://cdn.tailwindcss.com'],
        'style-src': ["'self'", "'unsafe-inline'"],
      },
    },
  }),
);
app.use(cors(corsConfig));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));
app.use(
  morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) },
  }),
);
app.use(globalRateLimiter);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (_req, res) => res.json(swaggerSpec));

app.get('/login', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

app.get('/dashboard', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

const router = express.Router();
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);
router.use('/permisos', permisoRoutes);
router.use('/menu', menuRoutes);

router.use('/fincas', fincaRoutes);
router.use('/lotes', loteRoutes);
router.use('/plantas', plantaRoutes);
router.use('/categorias-planta', categoriaPlantaRoutes);
router.use('/tipos-evaluacion', tipoEvaluacionRoutes);
router.use('/semanas', semanaRoutes);
// Los tres routers siguientes comparten el prefijo '/evaluaciones':
// evaluacionRoutes maneja '/', '/:uuid'; los otros anidan '/:uuid/infeccion',
// '/:uuid/conteo-hojas' y '/:uuid/suma-bruta' respectivamente.
router.use('/evaluaciones', evaluacionRoutes);
router.use('/evaluaciones', infeccionRoutes);
router.use('/evaluaciones', conteoHojasRoutes);
router.use('/evaluaciones', sumaBrutaRoutes);

router.use('/motivos-repique', motivoRepiqueRoutes);
router.use('/motivos-recuse', motivoRecuseRoutes);
router.use('/racimo-movimientos', racimoMovimientoRoutes);
router.use('/produccion-semanal', produccionSemanalRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/labores-culturales', laborCulturalRoutes);
router.use('/clima', climaRoutes);
// Alias por compatibilidad con builds de la app móvil ya instalados que
// todavía le pegan a /precipitaciones (nombre anterior del módulo).
router.use('/precipitaciones', climaRoutes);
router.use('/precipitacion-diaria', precipitacionDiariaRoutes);

router.use('/configuraciones', configuracionRoutes);
router.use('/sistema', resetDatosRoutes);
router.use('/sistema', setupRoutes);

app.use(env.apiPrefix, router);

app.get('/health', (_req, res) => res.json({ success: true, message: 'OK', data: null }));

app.use(notFound);
app.use(errorHandler);

export default app;
