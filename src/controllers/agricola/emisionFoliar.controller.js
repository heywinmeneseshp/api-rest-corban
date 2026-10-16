import { emisionFoliarService } from '../../services/agricola/emisionFoliar.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const emisionFoliarController = {
  getByEvaluacion: asyncHandler(async (req, res) => {
    const data = await emisionFoliarService.getByEvaluacionUuid(req.params.uuid, req.user);
    ApiResponse.send(res, { message: 'Emisión foliar obtenida correctamente', data });
  }),

  create: asyncHandler(async (req, res) => {
    const data = await emisionFoliarService.create(req.params.uuid, req.body, req.user?.id, req.user);
    ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Emisión foliar registrada correctamente', data });
  }),

  update: asyncHandler(async (req, res) => {
    const data = await emisionFoliarService.update(req.params.uuid, req.body, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Emisión foliar actualizada correctamente', data });
  }),

  seguimiento: asyncHandler(async (req, res) => {
    const data = await emisionFoliarService.seguimiento(req.query, req.user);
    ApiResponse.send(res, { message: 'Seguimiento de emisión foliar obtenido correctamente', data });
  }),
};

export default emisionFoliarController;
