import { Op } from 'sequelize';
import { Finca, Lote } from '../../database/associations.js';
import { sequelize } from '../../database/connection.js';
import { fincaCapaMapaRepository } from '../../repositories/agricola/fincaCapaMapa.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { assertFincaPermitida } from '../../utils/fincaScope.js';

const findFincaOrFail = async (uuid, user) => {
  const finca = await Finca.findOne({ where: { uuid } });
  if (!finca) throw ApiError.notFound('Finca no encontrada');
  assertFincaPermitida(user, finca.id);
  return finca;
};

const aPlano = (c) => ({
  uuid: c.uuid,
  categoria: c.categoria,
  subtipo: c.subtipo,
  nombre: c.nombre,
  geometria: c.geometria,
  coordenadas: c.coordenadas,
  lote: c.lote ? { uuid: c.lote.uuid, codigo: c.lote.codigo, nombre: c.lote.nombre } : null,
});

export const fincaCapaMapaService = {
  async list(fincaUuid, query, user) {
    const finca = await findFincaOrFail(fincaUuid, user);
    const filas = await fincaCapaMapaRepository.findAllByFinca(finca.id, { categoria: query.categoria });
    return { items: filas.map(aPlano) };
  },

  // Reemplaza TODA la categoría de la finca (atómico): reimportar el mismo
  // archivo no duplica elementos.
  async reemplazar(fincaUuid, payload, actorId, user) {
    const finca = await findFincaOrFail(fincaUuid, user);

    const loteUuids = [...new Set(payload.elementos.map((e) => e.loteUuid).filter(Boolean))];
    const lotes = loteUuids.length
      ? await Lote.findAll({ where: { uuid: { [Op.in]: loteUuids }, fincaId: finca.id }, attributes: ['id', 'uuid'] })
      : [];
    const loteIdPorUuid = new Map(lotes.map((l) => [l.uuid, l.id]));

    const creadas = await sequelize.transaction(async (transaction) => {
      await fincaCapaMapaRepository.borrarPorCategoria(finca.id, payload.categoria, actorId, { transaction });
      if (payload.elementos.length === 0) return [];
      return fincaCapaMapaRepository.bulkCreate(
        payload.elementos.map((e) => ({
          fincaId: finca.id,
          loteId: e.loteUuid ? loteIdPorUuid.get(e.loteUuid) ?? null : null,
          categoria: payload.categoria,
          subtipo: e.subtipo || null,
          nombre: e.nombre || null,
          geometria: e.geometria,
          coordenadas: e.coordenadas,
          createdBy: actorId,
        })),
        { transaction },
      );
    });
    return { categoria: payload.categoria, guardados: creadas.length };
  },

  async borrar(fincaUuid, query, actorId, user) {
    const finca = await findFincaOrFail(fincaUuid, user);
    await fincaCapaMapaRepository.borrarPorCategoria(finca.id, query.categoria, actorId);
  },
};

export default fincaCapaMapaService;
