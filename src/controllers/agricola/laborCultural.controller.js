import { laborCulturalService } from '../../services/agricola/laborCultural.service.js';
import { configuracionService } from '../../services/sistema/configuracion.service.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';

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

  async updateLote(req, res, next) {
    try {
      const result = await laborCulturalService.updateLote(
        req.params.visitaUuid,
        req.params.loteUuid,
        req.body,
        req.user?.uuid,
      );
      ApiResponse.send(res, {
        statusCode: HTTP_STATUS.OK,
        message: 'Lote de la visita actualizado correctamente',
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
      // Sin permiso dedicado: cualquier autenticado puede ver el listado de
      // visitas — lo que restringe qué ve es el alcance de finca del propio
      // usuario (ver getFincaUuidsPermitidas en el servicio).
      const result = await laborCulturalService.listVisitas(req.query, req.user);
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
      // Igual que listVisitas: sin permiso dedicado, restringido solo por
      // el alcance de finca del usuario.
      const result = await laborCulturalService.getVisita(req.params.visitaUuid, req.user);
      ApiResponse.send(res, {
        statusCode: HTTP_STATUS.OK,
        message: 'Visita de labor cultural obtenida correctamente',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  async deleteVisita(req, res, next) {
    try {
      const result = await laborCulturalService.deleteVisita(req.params.visitaUuid);
      ApiResponse.send(res, {
        statusCode: HTTP_STATUS.OK,
        message: 'Visita eliminada correctamente',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  async obtenerFoto(req, res, next) {
    try {
      const { stream, mimeType, nombre, visitaUuid } = await laborCulturalService.obtenerContenidoFoto(
        req.params.fotoUuid,
      );

      // Mismo alcance de finca que getVisita — lanza 404 si la finca de la
      // visita dueña de esta foto no está entre las permitidas del usuario.
      await laborCulturalService.getVisita(visitaUuid, req.user);

      res.setHeader('Content-Type', mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${(nombre || 'foto').replace(/"/g, '')}"`);
      stream.on('error', (error) => next(error));
      stream.pipe(res);
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

  async marcarRevisada(req, res, next) {
    try {
      const result = await laborCulturalService.marcarRevisada(req.params.visitaUuid, req.user);
      ApiResponse.send(res, {
        statusCode: HTTP_STATUS.OK,
        message: 'Visita marcada como revisada',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  async listRolesRevisores(req, res, next) {
    try {
      const result = await laborCulturalService.listRolesRevisores();
      ApiResponse.send(res, {
        statusCode: HTTP_STATUS.OK,
        message: 'Configuración de roles revisores obtenida correctamente',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  async crearRolRevisor(req, res, next) {
    try {
      const result = await laborCulturalService.crearRolRevisor(req.body.rolId, req.user?.id);
      ApiResponse.send(res, {
        statusCode: HTTP_STATUS.CREATED,
        message: 'Rol revisor configurado correctamente',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  async toggleRolRevisor(req, res, next) {
    try {
      await laborCulturalService.toggleRolRevisor(req.params.uuid, req.body.activo);
      ApiResponse.send(res, {
        statusCode: HTTP_STATUS.OK,
        message: 'Configuración actualizada correctamente',
      });
    } catch (error) {
      next(error);
    }
  },

  async eliminarRolRevisor(req, res, next) {
    try {
      await laborCulturalService.eliminarRolRevisor(req.params.uuid);
      ApiResponse.send(res, {
        statusCode: HTTP_STATUS.OK,
        message: 'Configuración eliminada correctamente',
      });
    } catch (error) {
      next(error);
    }
  },

  async getRevisorCc(req, res, next) {
    try {
      const cc = await configuracionService.getLaborRevisorCc();
      ApiResponse.send(res, {
        statusCode: HTTP_STATUS.OK,
        message: 'Copia (CC) obtenida correctamente',
        data: cc,
      });
    } catch (error) {
      next(error);
    }
  },

  async setRevisorCc(req, res, next) {
    try {
      const cc = await configuracionService.setLaborRevisorCc(
        {
          correos: req.body.correos,
          rolesUuids: req.body.rolesUuids,
          usuariosUuids: req.body.usuariosUuids,
        },
        req.user?.id,
      );
      ApiResponse.send(res, {
        statusCode: HTTP_STATUS.OK,
        message: 'Copia (CC) actualizada correctamente',
        data: cc,
      });
    } catch (error) {
      next(error);
    }
  },

  // Recibe el PDF ya generado en el navegador (jsPDF) y manda el aviso de
  // revisión aprobada con ese archivo adjunto.
  async enviarCorreoRevision(req, res, next) {
    try {
      if (!req.file) throw ApiError.badRequest('Falta el archivo PDF');
      const result = await laborCulturalService.enviarCorreoRevision(
        req.params.visitaUuid,
        req.file.buffer,
        req.file.originalname,
      );
      ApiResponse.send(res, {
        statusCode: HTTP_STATUS.OK,
        message: 'Correo de revisión enviado correctamente',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },
};

export default laborCulturalController;
