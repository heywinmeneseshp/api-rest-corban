import { Op, literal } from 'sequelize';
import { sequelize } from '../../database/connection.js';
import { Finca, Role, Lote, LoteAreaProduccion } from '../../database/associations.js';
import { loteAreaConfigRepository } from '../../repositories/agricola/loteAreaConfig.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { getFincaIdsPermitidas, expandirFincaIds } from '../../utils/fincaScope.js';

// Zona horaria del negocio, no la del servidor — mismo criterio (y mismo
// motivo: Vercel corre en UTC) que precipitacionDiaria.service.js.
const ZONA_NEGOCIO = 'America/Bogota';
const hoyIso = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_NEGOCIO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(),
  );

const findFincaByUuidOrFail = async (uuid) => {
  const finca = await Finca.findOne({ where: { uuid } });
  if (!finca) throw ApiError.notFound('Finca no encontrada');
  return finca;
};

export const loteAreaConfigService = {
  // ─── Configuración (admin) ───

  async crearConfig({ fincaUuid, rolId, fechaObjetivo }, actorId) {
    const finca = await findFincaByUuidOrFail(fincaUuid);
    const rol = await Role.findByPk(rolId);
    if (!rol) throw ApiError.notFound('Rol no encontrado');

    return loteAreaConfigRepository.create({
      fincaId: finca.id,
      rolId: rol.id,
      fechaObjetivo,
      createdBy: actorId,
    });
  },

  async listConfig(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await loteAreaConfigRepository.findAndCountAll({ limit, offset });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async toggleConfig(uuid, activo, actorId) {
    const config = await loteAreaConfigRepository.findByUuid(uuid);
    if (!config) throw ApiError.notFound('Configuración no encontrada');
    return loteAreaConfigRepository.update(config, { activo, updatedBy: actorId });
  },

  async eliminarConfig(uuid, actorId) {
    const config = await loteAreaConfigRepository.findByUuid(uuid);
    if (!config) throw ApiError.notFound('Configuración no encontrada');
    await loteAreaConfigRepository.softDelete(config, actorId);
  },

  // ─── Pendientes (usado por el modal bloqueante) ───
  //
  // Configs activas cuyo rol coincide con alguno de los del usuario, cuya
  // finca esté dentro de las que puede ver, y cuya fechaObjetivo ya llegó
  // (hoy o antes). A diferencia de Precipitación Diaria (que exige ponerse
  // al día con CADA día faltante desde una fecha de inicio), acá es un
  // evento puntual: si hay varias configs vencidas para la misma finca, se
  // usa la de fechaObjetivo más reciente. Si la finca pertenece a un Grupo
  // de Finca, se exige el área de los lotes de TODAS las fincas del grupo
  // (ver utils/fincaScope.js).
  async getPendientes(user) {
    const roles = user?.roles || [];
    if (roles.length === 0) return [];

    const configs = await loteAreaConfigRepository.findActivas();
    if (configs.length === 0) return [];

    const fincaIdsPermitidas = getFincaIdsPermitidas(user); // null = sin restricción
    const hoy = hoyIso();

    const relevantes = configs.filter(
      (c) =>
        roles.includes(c.rol?.nombre) &&
        (fincaIdsPermitidas === null || fincaIdsPermitidas.includes(c.fincaId)) &&
        c.fechaObjetivo <= hoy,
    );
    if (relevantes.length === 0) return [];

    const porFinca = new Map();
    for (const c of relevantes) {
      const actual = porFinca.get(c.fincaId);
      if (!actual || c.fechaObjetivo > actual.fechaObjetivo) porFinca.set(c.fincaId, c);
    }

    const pendientesPorFinca = [];
    for (const config of porFinca.values()) {
      const fincaIds = await expandirFincaIds([config.fincaId]);
      // Mismo orden natural por nombre (1, 2, 3, ... 10, 11) que el resto de
      // listados de lotes, con `codigo` como desempate estable.
      const lotes = await Lote.findAll({
        where: { fincaId: { [Op.in]: fincaIds }, estado: true },
        order: [[literal('CAST(`Lote`.`nombre` AS UNSIGNED)'), 'ASC'], ['codigo', 'ASC']],
      });
      if (lotes.length === 0) continue;

      const loteIds = lotes.map((l) => l.id);
      const cumplidos = await LoteAreaProduccion.findAll({
        where: {
          loteId: { [Op.in]: loteIds },
          fechaRegistro: { [Op.gte]: config.fechaObjetivo },
          areaTotal: { [Op.ne]: null },
        },
      });
      const loteIdsCumplidos = new Set(cumplidos.map((c) => c.loteId));
      const lotesPendientes = lotes.filter((l) => !loteIdsCumplidos.has(l.id));

      if (lotesPendientes.length > 0) {
        pendientesPorFinca.push({
          fincaUuid: config.finca.uuid,
          fincaNombre: config.finca.nombre,
          fechaObjetivo: config.fechaObjetivo,
          lotes: lotesPendientes.map((l) => ({ uuid: l.uuid, nombre: l.nombre, codigo: l.codigo, areaActual: l.area })),
        });
      }
    }

    return pendientesPorFinca;
  },

  // ─── Registro (desde el modal bloqueante) ───
  //
  // Sin chequeo de permiso más allá de `auth` (ver routes): el modal solo
  // puede enviar lo que el propio getPendientes le mostró, y exigir un
  // permiso amplio de edición de lotes bloquearía al rol designado si no lo
  // tiene. Mismo criterio que precipitacionDiariaService.registrar.
  async registrarLotes(registros, actorId) {
    if (!Array.isArray(registros) || registros.length === 0) {
      throw ApiError.badRequest('Debes enviar al menos un registro');
    }
    const hoy = hoyIso();

    return sequelize.transaction(async (transaction) => {
      const resultados = [];
      for (const r of registros) {
        if (!r.loteUuid || r.areaTotal === undefined || r.areaProduccion === undefined) {
          throw ApiError.badRequest('Cada registro requiere loteUuid, areaTotal y areaProduccion');
        }
        const lote = await Lote.findOne({ where: { uuid: r.loteUuid }, transaction });
        if (!lote) throw ApiError.notFound(`Lote no encontrado: ${r.loteUuid}`);

        await LoteAreaProduccion.create(
          {
            loteId: lote.id,
            area: r.areaProduccion,
            areaTotal: r.areaTotal,
            fechaRegistro: hoy,
            createdBy: actorId,
          },
          { transaction },
        );
        await lote.update({ area: r.areaTotal, updatedBy: actorId }, { transaction });
        resultados.push({ loteUuid: lote.uuid, areaTotal: r.areaTotal, areaProduccion: r.areaProduccion });
      }
      return resultados;
    });
  },
};

export default loteAreaConfigService;
