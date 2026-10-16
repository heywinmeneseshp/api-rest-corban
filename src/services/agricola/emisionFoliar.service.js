import { Op } from 'sequelize';
import { EmisionFoliar, Evaluacion, Planta, Lote, Finca, Semana } from '../../database/associations.js';
import { emisionFoliarRepository } from '../../repositories/agricola/emisionFoliar.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { getFincaIdsPermitidas, expandirFincaIds } from '../../utils/fincaScope.js';
import { findEvaluacionByUuidOrFail } from './evaluacionLookup.js';

export const emisionFoliarService = {
  async getByEvaluacionUuid(evaluacionUuid, user) {
    const evaluacion = await findEvaluacionByUuidOrFail(evaluacionUuid, user);
    const emision = await emisionFoliarRepository.findByEvaluacionId(evaluacion.id);
    if (!emision) throw ApiError.notFound('La evaluación no tiene emisión foliar registrada');
    return emision;
  },

  async create(evaluacionUuid, payload, actorId, user) {
    const evaluacion = await findEvaluacionByUuidOrFail(evaluacionUuid, user);
    const existing = await emisionFoliarRepository.findByEvaluacionId(evaluacion.id);
    if (existing) throw ApiError.conflict('Esta evaluación ya tiene una emisión foliar registrada');

    return emisionFoliarRepository.create({
      evaluacionId: evaluacion.id,
      hojasTotales: payload.hojasTotales,
      candela: payload.candela,
      estado: true,
      createdBy: actorId,
    });
  },

  async update(evaluacionUuid, payload, actorId, user) {
    const evaluacion = await findEvaluacionByUuidOrFail(evaluacionUuid, user);
    const emision = await emisionFoliarRepository.findByEvaluacionId(evaluacion.id);
    if (!emision) throw ApiError.notFound('La evaluación no tiene emisión foliar registrada');

    const data = { updatedBy: actorId };
    if (payload.hojasTotales !== undefined) data.hojasTotales = payload.hojasTotales;
    if (payload.candela !== undefined) data.candela = payload.candela;
    if (payload.estado !== undefined) data.estado = payload.estado;
    return emisionFoliarRepository.update(emision, data);
  },

  // Seguimiento semana a semana: una serie por planta evaluada (hojas
  // totales y candela por semana, más la variación de hojas contra la
  // semana anterior de ESA misma planta). Varias plantas a la vez — se
  // agrupan por planta, no se mezclan.
  async seguimiento(query, user) {
    const permitidas = getFincaIdsPermitidas(user);
    let fincaIds = permitidas;
    if (query.fincaUuid) {
      const finca = await Finca.findOne({ where: { uuid: query.fincaUuid }, attributes: ['id'] });
      if (!finca) throw ApiError.notFound('Finca no encontrada');
      const expandidas = await expandirFincaIds([finca.id]);
      fincaIds = permitidas === null ? expandidas : expandidas.filter((id) => permitidas.includes(id));
    }

    const plantaWhere = {};
    if (query.plantaUuid) plantaWhere.uuid = query.plantaUuid;
    const loteWhere = {};
    if (query.loteUuid) loteWhere.uuid = query.loteUuid;
    if (fincaIds !== null && fincaIds !== undefined) {
      loteWhere.fincaId = { [Op.in]: fincaIds.length ? fincaIds : [-1] };
    }

    const filas = await EmisionFoliar.findAll({
      where: { estado: true },
      include: [
        {
          model: Evaluacion,
          as: 'evaluacion',
          required: true,
          attributes: ['id', 'uuid', 'fecha'],
          include: [
            {
              model: Planta,
              as: 'planta',
              required: true,
              where: plantaWhere,
              attributes: ['id', 'uuid', 'codigo'],
              include: [
                { model: Lote, as: 'lote', required: true, where: loteWhere, attributes: ['id', 'uuid', 'codigo', 'nombre'] },
              ],
            },
            {
              model: Semana,
              as: 'semana',
              required: true,
              where: query.anio ? { anio: query.anio } : undefined,
              attributes: ['id', 'uuid', 'codigo', 'numeroSemana', 'anio', 'fechaInicio'],
            },
          ],
        },
      ],
    });

    const porPlanta = new Map();
    for (const f of filas) {
      const ev = f.evaluacion;
      const key = ev.planta.id;
      if (!porPlanta.has(key)) {
        porPlanta.set(key, {
          planta: { uuid: ev.planta.uuid, codigo: ev.planta.codigo },
          lote: { uuid: ev.planta.lote.uuid, codigo: ev.planta.lote.codigo, nombre: ev.planta.lote.nombre },
          semanas: [],
        });
      }
      porPlanta.get(key).semanas.push({
        evaluacionUuid: ev.uuid,
        fecha: ev.fecha,
        semana: {
          uuid: ev.semana.uuid,
          codigo: ev.semana.codigo,
          anio: ev.semana.anio,
          numeroSemana: ev.semana.numeroSemana,
        },
        fechaInicio: ev.semana.fechaInicio,
        hojasTotales: f.hojasTotales,
        candela: f.candela === null ? null : Number(f.candela),
      });
    }

    const plantas = [...porPlanta.values()].map((p) => {
      p.semanas.sort((a, b) => String(a.fechaInicio).localeCompare(String(b.fechaInicio)));
      p.semanas = p.semanas.map((s, i, arr) => ({
        ...s,
        variacionHojas: i === 0 ? null : s.hojasTotales - arr[i - 1].hojasTotales,
      }));
      return p;
    });
    plantas.sort((a, b) => a.planta.codigo.localeCompare(b.planta.codigo, undefined, { numeric: true }));
    return { plantas };
  },
};

export default emisionFoliarService;
