import { facturaService } from '../../services/inventario/factura.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const facturaController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await facturaService.list(req.query);
    ApiResponse.send(res, { message: 'Facturas obtenidas correctamente', data: { items, meta } });
  }),
  getByUuid: asyncHandler(async (req, res) => {
    const factura = await facturaService.getByUuid(req.params.uuid);
    ApiResponse.send(res, { message: 'Factura obtenida correctamente', data: factura });
  }),
};

export default facturaController;
