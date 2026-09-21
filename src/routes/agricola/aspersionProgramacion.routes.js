import { Router } from 'express';
import { aspersionProgramacionController } from '../../controllers/agricola/aspersionProgramacion.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { requireAdmin } from '../../middlewares/requireAdmin.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { uploadPdfAspersion, uploadExcelAspersion } from '../../middlewares/upload.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  createAspersionSchema,
  updateAspersionSchema,
  getAspersionSchema,
  listAspersionSchema,
  ejecutarAspersionSchema,
  enviarCorreoAspersionSchema,
  listUsuariosFincaSchema,
  actualizarComponenteAspersionSchema,
} from '../../validators/agricola/aspersionProgramacion.validator.js';

const router = Router();

router.get('/', auth, permission(PERMISSIONS.SANIDAD_ASPERSIONES_VER), validate(listAspersionSchema), aspersionProgramacionController.list);
// Config de quién recibe el aviso/cancelación por correo (además del
// destinatario puntual elegido al enviar) — Solo Administrador, mismo
// patrón que /evaluaciones/alertas-destinatarios.
router.get('/destinatarios', auth, requireAdmin, aspersionProgramacionController.getDestinatarios);
router.put('/destinatarios', auth, requireAdmin, aspersionProgramacionController.updateDestinatarios);
// Config de quién recibe el resumen semanal (Excel) — Solo Administrador.
router.get('/resumen-semanal/destinatarios', auth, requireAdmin, aspersionProgramacionController.getResumenSemanalDestinatarios);
router.put('/resumen-semanal/destinatarios', auth, requireAdmin, aspersionProgramacionController.updateResumenSemanalDestinatarios);
// "Enviar semana" del Calendario — adjunta el Excel armado en el navegador
// y lo manda a los destinatarios del resumen semanal.
router.post(
  '/resumen-semanal/enviar',
  auth,
  permission(PERMISSIONS.SANIDAD_ASPERSIONES_ENVIAR_CORREO),
  uploadExcelAspersion,
  aspersionProgramacionController.enviarResumenSemanal,
);
// Usuarios asignados a una finca — para el selector de "Administrador de
// finca" al programar (mismo permiso que crear: solo lo necesita quien va a
// programar una aspersión).
router.get(
  '/fincas/:fincaUuid/usuarios',
  auth,
  permission(PERMISSIONS.SANIDAD_ASPERSIONES_CREAR),
  validate(listUsuariosFincaSchema),
  aspersionProgramacionController.listUsuariosFinca,
);
router.post('/', auth, permission(PERMISSIONS.SANIDAD_ASPERSIONES_CREAR), validate(createAspersionSchema), aspersionProgramacionController.create);
router.get('/:uuid', auth, permission(PERMISSIONS.SANIDAD_ASPERSIONES_VER), validate(getAspersionSchema), aspersionProgramacionController.getByUuid);
router.put('/:uuid', auth, permission(PERMISSIONS.SANIDAD_ASPERSIONES_EDITAR), validate(updateAspersionSchema), aspersionProgramacionController.update);
router.patch(
  '/:uuid/componentes/:componenteUuid',
  auth,
  permission(PERMISSIONS.SANIDAD_ASPERSIONES_EDITAR),
  validate(actualizarComponenteAspersionSchema),
  aspersionProgramacionController.actualizarComponente,
);
router.delete('/:uuid', auth, permission(PERMISSIONS.SANIDAD_ASPERSIONES_ELIMINAR), validate(getAspersionSchema), aspersionProgramacionController.remove);
router.post('/:uuid/cancelar', auth, permission(PERMISSIONS.SANIDAD_ASPERSIONES_ELIMINAR), validate(getAspersionSchema), aspersionProgramacionController.cancelar);
router.post('/:uuid/ejecutar', auth, permission(PERMISSIONS.SANIDAD_ASPERSIONES_EJECUTAR), validate(ejecutarAspersionSchema), aspersionProgramacionController.ejecutar);
// Destinatarios sugeridos (resueltos de Configuración → Destinatarios para
// la finca de esta programación) — para prellenar el modal de envío.
router.get(
  '/:uuid/destinatarios-sugeridos',
  auth,
  permission(PERMISSIONS.SANIDAD_ASPERSIONES_ENVIAR_CORREO),
  validate(getAspersionSchema),
  aspersionProgramacionController.getDestinatariosSugeridos,
);
// PDF armado en el navegador (jsPDF), adjuntado y enviado por correo — igual
// que labores-culturales/visitas/:uuid/correo-revision.
router.post(
  '/:uuid/correo',
  auth,
  permission(PERMISSIONS.SANIDAD_ASPERSIONES_ENVIAR_CORREO),
  uploadPdfAspersion,
  validate(enviarCorreoAspersionSchema),
  aspersionProgramacionController.enviarCorreo,
);

export default router;
