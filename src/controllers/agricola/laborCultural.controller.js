import { laborCulturalService } from '../../services/agricola/laborCultural.service.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

export const laborCulturalController = {
  async create(req, res, next) {
    try {
      const result = await laborCulturalService.create(req.body, req.user?.id);
      ApiResponse.send(res, {
        statusCode: HTTP_STATUS.CREATED,
        message: 'Labor cultural registrada correctamente',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  async list(req, res, next) {
    try {
      const result = await laborCulturalService.list(req.query);
      ApiResponse.send(res, {
        statusCode: HTTP_STATUS.OK,
        message: 'Labores culturales obtenidas correctamente',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  async listVisitas(req, res, next) {
    try {
      const result = await laborCulturalService.listVisitas(req.query);
      ApiResponse.send(res, {
        statusCode: HTTP_STATUS.OK,
        message: 'Visitas de labor cultural obtenidas correctamente',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  async getVisita(req, res, next) {
    try {
      const result = await laborCulturalService.getVisita(req.params.visitaUuid);
      ApiResponse.send(res, {
        statusCode: HTTP_STATUS.OK,
        message: 'Visita de labor cultural obtenida correctamente',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  async agregarFotos(req, res, next) {
    try {
      const result = await laborCulturalService.agregarFotos(req.params.visitaUuid, req.files, req.user?.id);
      ApiResponse.send(res, {
        statusCode: HTTP_STATUS.CREATED,
        message: 'Fotos de la visita subidas correctamente',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },
};

export default laborCulturalController;
