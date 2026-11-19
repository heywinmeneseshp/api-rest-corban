import { Router } from 'express';
import Joi from 'joi';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { informeIcaService } from '../../services/agricola/informeIca.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

// Informe fitosanitario trimestral del ICA (Sanidad Vegetal).
const router = Router();
const uuid = Joi.string().guid({ version: 'uuidv4' });
const texto = Joi.string().trim().allow('', null).max(200);

const getSchema = Joi.object({
  query: Joi.object({ fincaUuid: uuid.required(), anio: Joi.number().integer().min(2000).max(2100).required(), trimestre: Joi.number().integer().min(1).max(4).required() }),
  params: Joi.object({}),
  body: Joi.object({}),
});
const datosSchema = Joi.object({
  body: Joi.object({
    fincaUuid: uuid.required(),
    datos: Joi.object({
      registroIca: texto, titular: texto, telefono: texto, correo: texto, departamento: texto, municipio: texto, vereda: texto,
      areaRegistrada: Joi.number().min(0).allow(null),
      asistenteNombre: texto, asistenteDocumento: texto, asistenteTarjeta: texto,
      asistenteCursoSv: Joi.string().valid('SI', 'NO', ''), asistenteSensorExterno: Joi.string().valid('SI', 'NO', ''),
      asistenteTelefono: texto, asistenteCorreo: texto, exportador: texto,
    }).required(),
  }),
  params: Joi.object({}),
  query: Joi.object({}),
});

router.get('/', auth, permission(PERMISSIONS.SANIDAD_COMPROBANTES_ASPERSION_VER), validate(getSchema), asyncHandler(async (req, res) => {
  ApiResponse.send(res, { message: 'Informe ICA', data: await informeIcaService.get(req.query, req.user) });
}));
router.put('/datos', auth, permission(PERMISSIONS.SANIDAD_COMPROBANTES_ASPERSION_EDITAR), validate(datosSchema), asyncHandler(async (req, res) => {
  ApiResponse.send(res, { message: 'Datos ICA guardados', data: await informeIcaService.guardarDatos(req.body, req.user?.id, req.user) });
}));

export default router;
