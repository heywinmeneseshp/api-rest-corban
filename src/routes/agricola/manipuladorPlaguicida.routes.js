import { Router } from 'express';
import Joi from 'joi';
import { Op } from 'sequelize';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { ManipuladorPlaguicida } from '../../database/models/manipuladorPlaguicida.model.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

// Manipuladores de plaguicidas (Sanidad Vegetal): listado para elegirlos en el comprobante de aspersión y creación desde su edición.
const router = Router();
const dto = (m) => ({ uuid: m.uuid, nombre: m.nombre, documento: m.documento || null });

router.get('/', auth, permission(PERMISSIONS.SANIDAD_COMPROBANTES_ASPERSION_VER), asyncHandler(async (_req, res) => {
  const lista = await ManipuladorPlaguicida.findAll({ where: { estado: true }, order: [['nombre', 'ASC']] });
  ApiResponse.send(res, { message: 'Manipuladores de plaguicidas', data: lista.map(dto) });
}));

const crearSchema = Joi.object({
  body: Joi.object({ nombre: Joi.string().trim().min(2).max(150).required(), documento: Joi.string().trim().max(30).allow(null, '') }),
  params: Joi.object({}),
  query: Joi.object({}),
});
router.post('/', auth, permission(PERMISSIONS.SANIDAD_COMPROBANTES_ASPERSION_EDITAR), validate(crearSchema), asyncHandler(async (req, res) => {
  const documento = req.body.documento?.trim() || null;
  if (documento && (await ManipuladorPlaguicida.findOne({ where: { documento, estado: true } }))) {
    throw ApiError.badRequest(`Ya existe un manipulador con la identificación ${documento}`);
  }
  const m = await ManipuladorPlaguicida.create({ nombre: req.body.nombre.trim(), documento, createdBy: req.user?.id });
  ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Manipulador creado', data: dto(m) });
}));

export default router;
