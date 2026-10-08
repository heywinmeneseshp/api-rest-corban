import { Router } from 'express';
import Joi from 'joi';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { fracLimiteService } from '../../services/agricola/fracLimite.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

const router = Router();

const vacio = Joi.object({});
const setLimiteSchema = Joi.object({
  body: Joi.object({ maxAplicaciones: Joi.number().integer().min(0).allow(null), maxPorcentaje: Joi.number().min(0).max(100).allow(null), maxConsecutivas: Joi.number().integer().min(0).allow(null), intervaloMinimoDias: Joi.number().integer().min(0).allow(null), soloEnMezclas: Joi.boolean(), modoAccion: Joi.string().trim().max(255).allow('', null) }),
  params: Joi.object({ codigo: Joi.string().trim().max(10).required() }),
  query: vacio,
});
const detalleSchema = Joi.object({
  body: vacio,
  params: vacio,
  query: Joi.object({
    fincaUuid: Joi.string().guid({ version: 'uuidv4' }).required(),
    fracCodigo: Joi.string().trim().max(10).required(),
    tipo: Joi.string().valid('APLICACIONES', 'PORCENTAJE', 'CONSECUTIVAS', 'INTERVALO', 'SOLO_MEZCLA').required(),
  }),
});
const verificarSchema = Joi.object({
  body: vacio,
  params: vacio,
  query: Joi.object({
    fincaUuid: Joi.string().guid({ version: 'uuidv4' }).required(),
    mezclaUuid: Joi.string().guid({ version: 'uuidv4' }).required(),
  }),
});

router.get('/', auth, permission(PERMISSIONS.INGREDIENTE_ACTIVO_VER), asyncHandler(async (req, res) => {
  ApiResponse.send(res, { data: await fracLimiteService.list() });
}));
const codigoSchema = Joi.object({ body: Joi.object({ codigo: Joi.string().trim().max(10).required(), modoAccion: Joi.string().trim().max(255).allow('', null) }), params: vacio, query: vacio });
const grupoSchema = Joi.object({ body: Joi.object({ nombre: Joi.string().trim().max(150).required(), fracCodigo: Joi.string().trim().max(10).required() }), params: vacio, query: vacio });
const grupoUpdateSchema = Joi.object({
  body: Joi.object({ nombre: Joi.string().trim().max(150), fracCodigo: Joi.string().trim().max(10) }).min(1),
  params: Joi.object({ uuid: Joi.string().guid({ version: 'uuidv4' }).required() }),
  query: vacio,
});
const grupoDeleteSchema = Joi.object({ body: vacio, params: Joi.object({ uuid: Joi.string().guid({ version: 'uuidv4' }).required() }), query: vacio });
const codigoDeleteSchema = Joi.object({ body: vacio, params: Joi.object({ codigo: Joi.string().trim().max(10).required() }), query: vacio });

router.post('/', auth, permission(PERMISSIONS.INGREDIENTE_ACTIVO_CREAR), validate(codigoSchema), asyncHandler(async (req, res) => {
  ApiResponse.send(res, { message: 'Código FRAC creado', data: await fracLimiteService.createCodigo(req.body, req.user?.id) });
}));
router.post('/grupos', auth, permission(PERMISSIONS.INGREDIENTE_ACTIVO_CREAR), validate(grupoSchema), asyncHandler(async (req, res) => {
  ApiResponse.send(res, { message: 'Grupo químico creado', data: await fracLimiteService.createGrupo(req.body, req.user?.id) });
}));
router.put('/grupos/:uuid', auth, permission(PERMISSIONS.INGREDIENTE_ACTIVO_EDITAR), validate(grupoUpdateSchema), asyncHandler(async (req, res) => {
  ApiResponse.send(res, { message: 'Grupo químico actualizado', data: await fracLimiteService.updateGrupo(req.params.uuid, req.body, req.user?.id) });
}));
router.delete('/grupos/:uuid', auth, permission(PERMISSIONS.INGREDIENTE_ACTIVO_ELIMINAR), validate(grupoDeleteSchema), asyncHandler(async (req, res) => {
  await fracLimiteService.deleteGrupo(req.params.uuid);
  ApiResponse.send(res, { message: 'Grupo químico eliminado', data: {} });
}));
router.delete('/:codigo', auth, permission(PERMISSIONS.INGREDIENTE_ACTIVO_ELIMINAR), validate(codigoDeleteSchema), asyncHandler(async (req, res) => {
  await fracLimiteService.deleteCodigo(req.params.codigo);
  ApiResponse.send(res, { message: 'Código FRAC eliminado', data: {} });
}));
router.get('/grupos', auth, permission(PERMISSIONS.INGREDIENTE_ACTIVO_VER), asyncHandler(async (req, res) => {
  ApiResponse.send(res, { data: await fracLimiteService.listGrupos() });
}));
router.get('/alertas', auth, permission(PERMISSIONS.SANIDAD_ASPERSIONES_VER), asyncHandler(async (req, res) => {
  ApiResponse.send(res, { data: await fracLimiteService.alertas(req.user) });
}));
router.get('/alertas/detalle', auth, permission(PERMISSIONS.SANIDAD_ASPERSIONES_VER), validate(detalleSchema), asyncHandler(async (req, res) => {
  ApiResponse.send(res, { data: await fracLimiteService.detalleAlerta(req.query, req.user) });
}));
router.get('/verificar', auth, permission(PERMISSIONS.SANIDAD_ASPERSIONES_VER), validate(verificarSchema), asyncHandler(async (req, res) => {
  ApiResponse.send(res, { data: await fracLimiteService.verificar(req.query, req.user) });
}));
router.put('/:codigo', auth, permission(PERMISSIONS.INGREDIENTE_ACTIVO_EDITAR), validate(setLimiteSchema), asyncHandler(async (req, res) => {
  ApiResponse.send(res, { message: 'Límite actualizado', data: await fracLimiteService.setLimite(req.params.codigo, req.body, req.user?.id) });
}));

export default router;
