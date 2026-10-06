import { Router } from 'express';
import { estacionMeteorologicaController } from '../../controllers/agricola/estacionMeteorologica.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { requireAdmin } from '../../middlewares/requireAdmin.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { historicoSchema, sincronizarSchema, sincronizarFaltantesSchema, ucBasesSchema, openMeteoListarSchema, openMeteoActualizarSchema, openMeteoConfigSchema } from '../../validators/agricola/estacionMeteorologica.validator.js';

const router = Router();

// Alerta por correo cuando la estación lleva más de 24 h sin datos: estado
// de conexión (cualquiera con acceso al módulo) y destinatarios (solo
// Administrador, igual que los destinatarios de Alertas de Sanidad Vegetal).
router.get('/estado-conexion', auth, permission(PERMISSIONS.ESTACION_METEOROLOGICA_VER), estacionMeteorologicaController.estadoConexion);
router.get('/alerta-destinatarios', auth, requireAdmin, estacionMeteorologicaController.getAlertaDestinatarios);
router.put('/alerta-destinatarios', auth, requireAdmin, estacionMeteorologicaController.setAlertaDestinatarios);
// Bases de las columnas de Unidades Calóricas del histórico diario: lectura
// para quien ve el módulo, edición solo Administrador.
router.get('/uc-bases', auth, permission(PERMISSIONS.ESTACION_METEOROLOGICA_VER), estacionMeteorologicaController.getUcBases);
router.put('/uc-bases', auth, requireAdmin, validate(ucBasesSchema), estacionMeteorologicaController.setUcBases);
// Open-Meteo: clima por finca (coordenadas en Maestros > Fincas). Ver y
// actualizar: quien ve el módulo; la frecuencia de actualización la edita
// solo el Administrador.
router.get('/open-meteo/fincas', auth, permission(PERMISSIONS.ESTACION_METEOROLOGICA_VER), estacionMeteorologicaController.openMeteoFincas);
router.get('/open-meteo/actuales', auth, permission(PERMISSIONS.ESTACION_METEOROLOGICA_VER), estacionMeteorologicaController.openMeteoActuales);
router.get('/open-meteo/configuracion', auth, permission(PERMISSIONS.ESTACION_METEOROLOGICA_VER), estacionMeteorologicaController.openMeteoGetConfig);
router.put('/open-meteo/configuracion', auth, requireAdmin, validate(openMeteoConfigSchema), estacionMeteorologicaController.openMeteoSetConfig);
router.post(
  '/open-meteo/actualizar',
  auth,
  permission(PERMISSIONS.ESTACION_METEOROLOGICA_VER),
  validate(openMeteoActualizarSchema),
  estacionMeteorologicaController.openMeteoActualizar,
);
router.post(
  '/open-meteo/actualizar-faltantes',
  auth,
  permission(PERMISSIONS.ESTACION_METEOROLOGICA_VER),
  estacionMeteorologicaController.openMeteoActualizarFaltantes,
);
router.get(
  '/open-meteo',
  auth,
  permission(PERMISSIONS.ESTACION_METEOROLOGICA_VER),
  validate(openMeteoListarSchema),
  estacionMeteorologicaController.openMeteoListar,
);
router.get('/actual', auth, permission(PERMISSIONS.ESTACION_METEOROLOGICA_VER), estacionMeteorologicaController.actual);
router.get(
  '/historico',
  auth,
  permission(PERMISSIONS.ESTACION_METEOROLOGICA_VER),
  validate(historicoSchema),
  estacionMeteorologicaController.historico,
);
router.post(
  '/sincronizar',
  auth,
  permission(PERMISSIONS.ESTACION_METEOROLOGICA_VER),
  validate(sincronizarSchema),
  estacionMeteorologicaController.sincronizar,
);
router.post(
  '/sincronizar-faltantes',
  auth,
  permission(PERMISSIONS.ESTACION_METEOROLOGICA_VER),
  validate(sincronizarFaltantesSchema),
  estacionMeteorologicaController.sincronizarFaltantes,
);

export default router;
