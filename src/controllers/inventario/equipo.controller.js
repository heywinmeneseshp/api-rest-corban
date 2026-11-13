import { equipoService } from '../../services/inventario/equipo.service.js';
import { lecturaEquipoService } from '../../services/inventario/lecturaEquipo.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { ROLES } from '../../constants/roles.constants.js';

export const equipoController = {
  // ─── Lecturas de kilometraje / horas ───
  registrarLectura: asyncHandler(async (req, res) => {
    // `corregir` (aceptar una lectura menor a la anterior) solo lo puede quien edita equipos.
    const puedeCorregir = (req.user?.roles || []).includes(ROLES.ADMINISTRADOR) || (req.user?.permissions || []).includes(PERMISSIONS.INVENTARIO_EQUIPOS_EDITAR);
    const datos = { ...req.body, corregir: Boolean(req.body.corregir) && Boolean(puedeCorregir), origen: 'WEB' };
    const data = await lecturaEquipoService.registrar(req.params.uuid, datos, req.user);
    ApiResponse.send(res, { statusCode: data.duplicada ? 200 : HTTP_STATUS.CREATED, message: 'Lectura registrada correctamente', data });
  }),
  registrarLecturasLote: asyncHandler(async (req, res) => {
    const data = await lecturaEquipoService.registrarLote(req.body.items.map((i) => ({ ...i, corregir: false })), req.user);
    ApiResponse.send(res, { message: 'Lecturas procesadas', data });
  }),
  historialLecturas: asyncHandler(async (req, res) => {
    ApiResponse.send(res, { message: 'Lecturas obtenidas correctamente', data: await lecturaEquipoService.historial(req.params.uuid, req.query) });
  }),
  paraLecturas: asyncHandler(async (req, res) => {
    ApiResponse.send(res, { message: 'Equipos obtenidos correctamente', data: await lecturaEquipoService.paraApp() });
  }),

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
    const equipo = await equipoService.addComponente(req.params.uuid, req.body.articuloUuid, req.body.notas);
    ApiResponse.send(res, { message: 'Repuesto compatible agregado', data: equipo });
  }),

  removeComponente: asyncHandler(async (req, res) => {
    const equipo = await equipoService.removeComponente(req.params.uuid, req.params.articuloUuid);
    ApiResponse.send(res, { message: 'Repuesto compatible eliminado', data: equipo });
  }),
};

export default equipoController;
