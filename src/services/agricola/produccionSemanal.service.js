import { parseBulkFile } from '../../utils/bulkFileParser.js';
import { produccionSemanalRepository } from '../../repositories/agricola/produccionSemanal.repository.js';
import { Finca, Semana } from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';
import { getFincaIdsPermitidas, assertFincaPermitida } from '../../utils/fincaScope.js';

export const produccionSemanalService = {
  async listProduccion(query, user) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const offset = (page - 1) * limit;

    const fincaId = query.fincaUuid
      ? (await Finca.findOne({ where: { uuid: query.fincaUuid } }))?.id
      : undefined;
    if (fincaId) assertFincaPermitida(user, fincaId);
    const semanaId = query.semanaUuid
      ? (await Semana.findOne({ where: { uuid: query.semanaUuid } }))?.id
      : undefined;

    const { rows, count } = await produccionSemanalRepository.findAndCountAll({
      limit, offset, fincaId, fincaIds: getFincaIdsPermitidas(user), semanaId,
    });

    return {
      items: rows,
      page, limit, total: count, totalPages: Math.ceil(count / limit),
    };
  },

  async bulkCreateProduccion(file, actorId, user) {
    const filas = parseBulkFile(file);
    if (filas.length === 0) throw ApiError.badRequest('El archivo está vacío');

    const fincaIdsPermitidas = getFincaIdsPermitidas(user);
    const errores = [];
    const filasValidas = [];

    // Pre-cache catálogos
    const todasFincas = await Finca.findAll({ attributes: ['id', 'codigo'] });
    const todasSemanas = await Semana.findAll({ attributes: ['id', 'codigo', 'anio', 'numeroSemana'] });

    const fincaPorCodigo = new Map(todasFincas.map((f) => [f.codigo, f.id]));
    const semanaPorCodigo = new Map(todasSemanas.map((s) => [s.codigo, s.id]));

    for (let i = 0; i < filas.length; i++) {
      const row = filas[i];
      const nro = i + 2;

      const semanaCodigo = String(row.semana || row.semanacodigo || '').trim();
      const fincaCodigo = String(row.fincacodigo || row.finca || row.codigofinca || '').trim().toUpperCase();
      const cajasRaw = Number(row.cajas || row.cajas20kg || row.cajasproducidas || row.cajas_20kg || 0);

      if (!semanaCodigo) {
        errores.push({ fila: nro, error: 'Semana no proporcionada' });
        continue;
      }
      if (!fincaCodigo) {
        errores.push({ fila: nro, error: 'Código de finca no proporcionado' });
        continue;
      }

      const semanaId = semanaPorCodigo.get(semanaCodigo);
      if (!semanaId) {
        errores.push({ fila: nro, error: `Semana "${semanaCodigo}" no encontrada` });
        continue;
      }

      const fincaId = fincaPorCodigo.get(fincaCodigo);
      if (!fincaId) {
        errores.push({ fila: nro, error: `Finca "${fincaCodigo}" no encontrada` });
        continue;
      }
      if (fincaIdsPermitidas !== null && !fincaIdsPermitidas.includes(fincaId)) {
        errores.push({ fila: nro, error: `No tienes acceso a la finca "${fincaCodigo}"` });
        continue;
      }

      if (!Number.isFinite(cajasRaw) || cajasRaw < 0) {
        errores.push({ fila: nro, error: `Cajas "${row.cajas || ''}" no es un número válido` });
        continue;
      }

      filasValidas.push({ semanaId, fincaId, cajas20kg: Math.round(cajasRaw), createdBy: actorId });
    }

    if (filasValidas.length === 0) {
      return { totalFilas: filas.length, creados: 0, errores };
    }

    // Consultar registros existentes para filtrar duplicados
    const semanaIds = [...new Set(filasValidas.map((f) => f.semanaId))];
    const fincaIds = [...new Set(filasValidas.map((f) => f.fincaId))];
    const existentes = await produccionSemanalRepository.findAllBySemanaYFinca({ semanaIds, fincaIds });
    const existenteSet = new Set(existentes.map((e) => `${e.semanaId}-${e.fincaId}`));

    const aInsertar = filasValidas.filter((f) => !existenteSet.has(`${f.semanaId}-${f.fincaId}`));
    const saltados = filasValidas.length - aInsertar.length;

    if (aInsertar.length > 0) {
      await produccionSemanalRepository.bulkCreate(aInsertar);
    }

    return {
      totalFilas: filas.length,
      creados: aInsertar.length,
      saltados,
      errores: errores.length > 0 ? errores : undefined,
    };
  },
};

export default produccionSemanalService;
