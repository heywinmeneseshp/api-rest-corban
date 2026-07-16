import { Semana } from '../../database/associations.js';
import { semanaRepository } from '../../repositories/agricola/semana.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';

export const semanaService = {
  async listSemanas(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await semanaRepository.findAndCountAll({
      limit,
      offset,
      anio: query.anio ? Number(query.anio) : undefined,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getSemanaByUuid(uuid) {
    const semana = await semanaRepository.findByUuid(uuid);
    if (!semana) throw ApiError.notFound('Semana no encontrada');
    return semana;
  },

  async createSemana(payload, actorId) {
    const existingCodigo = await semanaRepository.findByCodigo(payload.codigo);
    if (existingCodigo) throw ApiError.conflict('Ya existe una semana con ese código');

    const existingNumero = await semanaRepository.findByAnioAndNumero(
      payload.anio,
      payload.numeroSemana,
    );
    if (existingNumero) throw ApiError.conflict('Ya existe esa semana para el año indicado');

    return semanaRepository.create({
      codigo: payload.codigo,
      numeroSemana: payload.numeroSemana,
      anio: payload.anio,
      fechaInicio: payload.fechaInicio,
      fechaFin: payload.fechaFin,
      estado: payload.estado ?? true,
      createdBy: actorId,
    });
  },

  async updateSemana(uuid, payload, actorId) {
    const semana = await this.getSemanaByUuid(uuid);

    if (payload.codigo) {
      const existing = await semanaRepository.findByCodigo(payload.codigo);
      if (existing && existing.id !== semana.id) {
        throw ApiError.conflict('Ya existe una semana con ese código');
      }
    }

    if (payload.anio !== undefined || payload.numeroSemana !== undefined) {
      const anio = payload.anio ?? semana.anio;
      const numeroSemana = payload.numeroSemana ?? semana.numeroSemana;
      const existing = await semanaRepository.findByAnioAndNumero(anio, numeroSemana);
      if (existing && existing.id !== semana.id) {
        throw ApiError.conflict('Ya existe esa semana para el año indicado');
      }
    }

    return semanaRepository.update(semana, { ...payload, updatedBy: actorId });
  },

  async deleteSemana(uuid, actorId) {
    const semana = await this.getSemanaByUuid(uuid);
    await semanaRepository.softDelete(semana, actorId);
  },

  async generarAnio(payload, actorId) {
    const { anio, fechaInicioSemana1, totalSemanas } = payload;

    const parseLocal = (s) => {
      const [y, m, d] = s.split('-').map(Number);
      return new Date(y, m - 1, d);
    };

    const toLocalStr = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const startDate = parseLocal(fechaInicioSemana1);
    if (startDate.getDay() !== 1) {
      throw ApiError.badRequest('La fecha de inicio debe ser un lunes');
    }

    const pad = (n) => String(n).padStart(2, '0');

    const weeks = Array.from({ length: totalSemanas }, (_, i) => {
      const weekNum = i + 1;
      const inicio = new Date(startDate);
      inicio.setDate(inicio.getDate() + i * 7);
      const fin = new Date(inicio);
      fin.setDate(fin.getDate() + 6);

      return {
        codigo: `S${pad(weekNum)}-${anio}`,
        numeroSemana: weekNum,
        anio,
        fechaInicio: toLocalStr(inicio),
        fechaFin: toLocalStr(fin),
        estado: true,
        createdBy: actorId,
      };
    });

    return Semana.sequelize.transaction(async (transaction) => {
      await semanaRepository.forceDeleteByAnio(anio, { transaction });
      return semanaRepository.bulkCreate(weeks, { transaction });
    });
  },
};

export default semanaService;
