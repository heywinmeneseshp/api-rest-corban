import { ordenChecklistService } from '../../services/inventario/ordenChecklist.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const ordenChecklistController = {
  obtener: asyncHandler(async (req, res) => ApiResponse.send(res, { message: 'Checklist obtenido correctamente', data: await ordenChecklistService.obtener(req.params.uuid) })),
  generar: asyncHandler(async (req, res) =>
    ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Checklist generado correctamente', data: await ordenChecklistService.generar(req.params.uuid, req.body?.plantillaUuid) })),
  guardar: asyncHandler(async (req, res) => ApiResponse.send(res, { message: 'Checklist guardado correctamente', data: await ordenChecklistService.guardarItems(req.params.uuid, req.body.items, req.user) })),
  crearHallazgo: asyncHandler(async (req, res) =>
    ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Hallazgo creado correctamente', data: await ordenChecklistService.crearHallazgo(req.params.uuid, req.body, req.user) })),
  actualizarHallazgo: asyncHandler(async (req, res) => ApiResponse.send(res, { message: 'Hallazgo actualizado correctamente', data: await ordenChecklistService.actualizarHallazgo(req.params.hUuid, req.body, req.user) })),
  eliminarHallazgo: asyncHandler(async (req, res) => {
    await ordenChecklistService.eliminarHallazgo(req.params.hUuid);
    ApiResponse.send(res, { message: 'Hallazgo eliminado correctamente' });
  }),
  programarHallazgo: asyncHandler(async (req, res) => ApiResponse.send(res, { message: 'Programación creada a partir del hallazgo', data: await ordenChecklistService.programarCorreccion(req.params.hUuid, req.body || {}, req.user) })),
  hallazgosDeEquipo: asyncHandler(async (req, res) => ApiResponse.send(res, { message: 'Hallazgos obtenidos correctamente', data: await ordenChecklistService.hallazgosDeEquipo(req.params.uuid, req.query) })),
};

export default ordenChecklistController;
