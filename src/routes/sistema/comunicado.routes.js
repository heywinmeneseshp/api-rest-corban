import { Router } from 'express';
import { comunicadoController } from '../../controllers/sistema/comunicado.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { requireAdmin } from '../../middlewares/requireAdmin.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { uploadComunicadoAdjuntos } from '../../middlewares/upload.middleware.js';
import { enviarComunicadoSchema, getComunicadoSchema, listComunicadoSchema } from '../../validators/sistema/comunicado.validator.js';

const router = Router();

// El envío llega como multipart/form-data (para poder mandar adjuntos en el
// mismo POST) — multer solo parsea los archivos, los campos de texto llegan
// bien pero los arreglos (correos/rolesUuids/usuariosUuids) llegan como
// strings JSON sueltos, hay que parsearlos ANTES de que Joi los valide.
function parseCamposArreglo(req, _res, next) {
  for (const campo of ['correos', 'rolesUuids', 'usuariosUuids']) {
    if (typeof req.body[campo] === 'string') {
      try {
        req.body[campo] = JSON.parse(req.body[campo]);
      } catch {
        req.body[campo] = [];
      }
    }
  }
  next();
}

/**
 * @openapi
 * /comunicados:
 *   get:
 *     tags: [Comunicados]
 *     summary: Listar historial de comunicados enviados. Solo Administrador.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   post:
 *     tags: [Comunicados]
 *     summary: Enviar un comunicado por correo a roles, usuarios y/o correos manuales. Solo Administrador.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Enviado }
 */
router.get('/', auth, requireAdmin, validate(listComunicadoSchema), comunicadoController.list);
router.post(
  '/',
  auth,
  requireAdmin,
  uploadComunicadoAdjuntos,
  parseCamposArreglo,
  validate(enviarComunicadoSchema),
  comunicadoController.enviar,
);

/**
 * @openapi
 * /comunicados/{uuid}:
 *   get:
 *     tags: [Comunicados]
 *     summary: Detalle de un comunicado (incluye resultado por destinatario). Solo Administrador.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get('/:uuid', auth, requireAdmin, validate(getComunicadoSchema), comunicadoController.getByUuid);

export default router;
