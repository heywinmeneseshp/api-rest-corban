import { comunicadoService } from '../../services/sistema/comunicado.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const comunicadoController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await comunicadoService.list(req.query);
    ApiResponse.send(res, { message: 'Comunicados obtenidos correctamente', data: { items, meta } });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const comunicado = await comunicadoService.getByUuid(req.params.uuid);
    ApiResponse.send(res, { message: 'Comunicado obtenido correctamente', data: comunicado });
  }),

  enviar: asyncHandler(async (req, res) => {
    const comunicado = await comunicadoService.enviar(req.body, req.user?.id, req.files || []);
    ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Comunicado enviado', data: comunicado });
  }),
};

export default comunicadoController;
