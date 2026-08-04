import { Finca } from '../../database/associations.js';
import { laborOcurrenciaRepository } from '../../repositories/agricola/laborOcurrencia.repository.js';
import { laborRepository } from '../../repositories/agricola/labor.repository.js';
import { userRepository } from '../../repositories/seguridad/user.repository.js';
import { laborSerieService } from './laborSerie.service.js';
import { ApiError } from '../../utils/ApiError.js';
import { assertFincaPermitida } from '../../utils/fincaScope.js';

const findFincaOrFail = async (uuid) => {
  const finca = await Finca.findOne({ where: { uuid } });
  if (!finca) throw ApiError.notFound('Finca no encontrada');
  return finca;
};

const findResponsableId = async (uuid) => {
  if (!uuid) return null;
  const responsable = await userRepository.findByUuid(uuid, { includeRoles: false });
  if (!responsable) throw ApiError.notFound('Responsable no encontrado');
  return responsable.id;
};

export const laborOcurrenciaService = {
  async listPorAnio(fincaUuid, anio, user) {
    const finca = await findFincaOrFail(fincaUuid);
    assertFincaPermitida(user, finca.id);
    const items = await laborOcurrenciaRepository.findByFincaAndAnio(finca.id, anio);
    return { items };
  },

  async getOcurrenciaByUuid(uuid, user) {
    const ocurrencia = await laborOcurrenciaRepository.findByUuid(uuid);
    if (!ocurrencia) throw ApiError.notFound('Ocurrencia no encontrada');
    assertFincaPermitida(user, ocurrencia.fincaId);
    return ocurrencia;
  },

  // `alcance` (por defecto 'ESTA') decide qué tanto de la serie se ve
  // afectado, igual que Google Calendar al editar un evento recurrente:
  // - ESTA: solo esta ocurrencia puntual (comportamiento de fase 1).
  // - ESTA_Y_SIGUIENTES: divide la serie en este punto (ver laborSerie.service).
  // - TODA_LA_SERIE: aplica el cambio a la serie y a todas sus ocurrencias
  //   pendientes.
  async updateOcurrencia(uuid, payload, actorId, user) {
    const { alcance = 'ESTA', ...campos } = payload;
    const ocurrencia = await this.getOcurrenciaByUuid(uuid, user);

    if (alcance !== 'ESTA' && !ocurrencia.serie?.esRecurrente) {
      throw ApiError.badRequest('Esta programación no es recurrente');
    }

    if (alcance === 'ESTA_Y_SIGUIENTES') {
      return laborSerieService.editarEstaYSiguientes(ocurrencia, campos, actorId, user);
    }
    if (alcance === 'TODA_LA_SERIE') {
      return laborSerieService.editarSerieCompleta(ocurrencia, campos, actorId, user);
    }

    const data = { ...campos, modificada: true, updatedBy: actorId };
    if (campos.laborUuid) {
      const labor = await laborRepository.findByUuid(campos.laborUuid);
      if (!labor) throw ApiError.notFound('Labor no encontrada');
      data.laborId = labor.id;
      delete data.laborUuid;
    }
    if (campos.responsableUuid !== undefined) {
      data.responsableId = await findResponsableId(campos.responsableUuid);
      delete data.responsableUuid;
    }
    return laborOcurrenciaRepository.update(ocurrencia, data);
  },

  async deleteOcurrencia(uuid, actorId, user, alcance = 'ESTA') {
    const ocurrencia = await this.getOcurrenciaByUuid(uuid, user);

    if (alcance !== 'ESTA' && !ocurrencia.serie?.esRecurrente) {
      throw ApiError.badRequest('Esta programación no es recurrente');
    }

    if (alcance === 'ESTA_Y_SIGUIENTES') {
      return laborSerieService.eliminarEstaYSiguientes(ocurrencia, actorId, user);
    }
    if (alcance === 'TODA_LA_SERIE') {
      return laborSerieService.deleteSerie(ocurrencia.serie.uuid, actorId, user);
    }

    await laborOcurrenciaRepository.softDelete(ocurrencia, actorId);
  },
};

export default laborOcurrenciaService;
