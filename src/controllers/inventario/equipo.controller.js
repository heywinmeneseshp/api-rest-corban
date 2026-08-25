import { equipoService } from '../../services/inventario/equipo.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const equipoController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await equipoService.list(req.query);
    ApiResponse.send(res, { message: 'Equipos obtenidos correctamente', data: { items, meta } });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const equipo = await equipoService.getByUuid(req.params.uuid);
    ApiResponse.send(res, { message: 'Equipo obtenido correctamente', data: equipo });
  }),

  create: asyncHandler(async (req, res) => {
    const equipo = await equipoService.create(req.body, req.user?.id);
    ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Equipo creado correctamente', data: equipo });
  }),

  update: asyncHandler(async (req, res) => {
    const equipo = await equipoService.update(req.params.uuid, req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Equipo actualizado correctamente', data: equipo });
  }),

  remove: asyncHandler(async (req, res) => {
    await equipoService.delete(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Equipo eliminado correctamente' });
  }),

  addComponente: asyncHandler(async (req, res) => {
    const equipo = await equipoService.addComponente(req.params.uuid, req.body.productoUuid, req.body.notas);
    ApiResponse.send(res, { message: 'Repuesto compatible agregado', data: equipo });
  }),

  removeComponente: asyncHandler(async (req, res) => {
    const equipo = await equipoService.removeComponente(req.params.uuid, req.params.productoUuid);
    ApiResponse.send(res, { message: 'Repuesto compatible eliminado', data: equipo });
  }),
};

export default equipoController;
