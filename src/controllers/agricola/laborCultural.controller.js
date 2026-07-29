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
};

export default laborCulturalController;
