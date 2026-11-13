import { checklistPlantillaService } from '../../services/inventario/checklistPlantilla.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const checklistPlantillaController = {
  list: asyncHandler(async (req, res) => ApiResponse.send(res, { message: 'Plantillas obtenidas correctamente', data: await checklistPlantillaService.list() })),
  getByUuid: asyncHandler(async (req, res) => ApiResponse.send(res, { message: 'Plantilla obtenida correctamente', data: await checklistPlantillaService.getByUuid(req.params.uuid) })),
  create: asyncHandler(async (req, res) =>
    ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Plantilla creada correctamente', data: await checklistPlantillaService.create(req.body, req.user?.id) })),
  update: asyncHandler(async (req, res) => ApiResponse.send(res, { message: 'Plantilla actualizada correctamente', data: await checklistPlantillaService.update(req.params.uuid, req.body, req.user?.id) })),
  remove: asyncHandler(async (req, res) => {
    await checklistPlantillaService.delete(req.params.uuid);
    ApiResponse.send(res, { message: 'Plantilla eliminada correctamente' });
  }),
};

export default checklistPlantillaController;
