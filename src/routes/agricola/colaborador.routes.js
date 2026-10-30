import { Router } from 'express';
import { colaboradorController } from '../../controllers/agricola/colaborador.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  listColaboradoresSchema,
  getColaboradorSchema,
  createColaboradorSchema,
  crearMiFichaSchema,
  actualizarMiFichaSchema,
  updateColaboradorSchema,
  vincularUsuarioSchema,
  crearUsuarioDeColaboradorSchema,
} from '../../validators/agricola/colaborador.validator.js';

const router = Router();

/**
 * @openapi
 * /colaboradores:
 *   get:
 *     tags: [Colaboradores]
 *     summary: Listar colaboradores (trabajadores de campo)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   post:
 *     tags: [Colaboradores]
 *     summary: Crear colaborador
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Creado }
 */
router.get('/', auth, permission(PERMISSIONS.COLABORADOR_VER, PERMISSIONS.SV_COLABORADOR_VER), validate(listColaboradoresSchema), colaboradorController.list);
router.post('/', auth, permission(PERMISSIONS.COLABORADOR_CREAR, PERMISSIONS.SV_COLABORADOR_CREAR), validate(createColaboradorSchema), colaboradorController.create);

// Autoservicio: la ficha propia (colaborador vinculado al usuario de la sesión). Antes de /:uuid.
const PUEDE_MI_FICHA = [PERMISSIONS.ASISTENCIA_MARCAR, PERMISSIONS.ASISTENCIA_MARCAR_CUADRILLA, PERMISSIONS.COLABORADOR_CREAR];
router.get('/mio', auth, permission(...PUEDE_MI_FICHA, PERMISSIONS.COLABORADOR_VER, PERMISSIONS.ASISTENCIA_VER), colaboradorController.miFicha);
router.post('/mio', auth, permission(...PUEDE_MI_FICHA), validate(crearMiFichaSchema), colaboradorController.crearMiFicha);
router.put('/mio', auth, permission(...PUEDE_MI_FICHA), validate(actualizarMiFichaSchema), colaboradorController.actualizarMiFicha);

/**
 * @openapi
 * /colaboradores/{uuid}:
 *   get:
 *     tags: [Colaboradores]
 *     summary: Obtener colaborador por UUID
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   put:
 *     tags: [Colaboradores]
 *     summary: Actualizar colaborador
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   delete:
 *     tags: [Colaboradores]
 *     summary: Eliminar colaborador (soft delete)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get('/:uuid', auth, permission(PERMISSIONS.COLABORADOR_VER, PERMISSIONS.SV_COLABORADOR_VER), validate(getColaboradorSchema), colaboradorController.getByUuid);
router.put('/:uuid', auth, permission(PERMISSIONS.COLABORADOR_EDITAR, PERMISSIONS.SV_COLABORADOR_EDITAR), validate(updateColaboradorSchema), colaboradorController.update);
router.put('/:uuid/usuario', auth, permission(PERMISSIONS.COLABORADOR_EDITAR, PERMISSIONS.SV_COLABORADOR_EDITAR), permission(PERMISSIONS.MENU_MAESTROS_USUARIOS), validate(vincularUsuarioSchema), colaboradorController.vincularUsuario);
router.delete('/:uuid/usuario', auth, permission(PERMISSIONS.COLABORADOR_EDITAR, PERMISSIONS.SV_COLABORADOR_EDITAR), validate(getColaboradorSchema), colaboradorController.desvincularUsuario);
router.post('/:uuid/usuario', auth, permission(PERMISSIONS.COLABORADOR_EDITAR, PERMISSIONS.SV_COLABORADOR_EDITAR), permission(PERMISSIONS.MENU_MAESTROS_USUARIOS), validate(crearUsuarioDeColaboradorSchema), colaboradorController.crearUsuario);
router.delete('/:uuid', auth, permission(PERMISSIONS.COLABORADOR_ELIMINAR, PERMISSIONS.SV_COLABORADOR_ELIMINAR), validate(getColaboradorSchema), colaboradorController.remove);

export default router;
