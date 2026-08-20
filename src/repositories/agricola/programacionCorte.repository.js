import { Op, QueryTypes } from 'sequelize';
import { ProgramacionCorte, Finca, Semana, Producto } from '../../database/associations.js';
import { sequelize } from '../../database/connection.js';

const listIncludes = [
  { model: Finca, as: 'finca', attributes: ['id', 'uuid', 'codigo', 'nombre'] },
  { model: Semana, as: 'semana', attributes: ['id', 'uuid', 'codigo', 'anio', 'numeroSemana'] },
  { model: Producto, as: 'producto', attributes: ['id', 'uuid', 'codigo', 'nombre'] },
];

export const programacionCorteRepository = {
  async findAndCountAll({ limit, offset, fincaId, fincaIds, semanaId, fechaDesde, fechaHasta }) {
    const where = {
      ...(fincaId ? { fincaId } : fincaIds ? { fincaId: { [Op.in]: fincaIds } } : {}),
      ...(semanaId ? { semanaId } : {}),
    };
    if (fechaDesde || fechaHasta) {
      where.fecha = {};
      if (fechaDesde) where.fecha[Op.gte] = fechaDesde;
      if (fechaHasta) where.fecha[Op.lte] = fechaHasta;
    }

    return ProgramacionCorte.findAndCountAll({
      where,
      include: listIncludes,
      limit,
      offset,
      order: [['fecha', 'DESC'], ['fincaId', 'ASC']],
      distinct: true,
    });
  },

  bulkCreate(dataArray, { transaction } = {}) {
    return ProgramacionCorte.bulkCreate(dataArray, { transaction });
  },

  findByUuid(uuid) {
    return ProgramacionCorte.findOne({ where: { uuid }, include: listIncludes });
  },

  async softDelete(registro, deletedBy, { transaction } = {}) {
    await registro.update({ deletedBy }, { transaction });
    await registro.destroy({ transaction });
    return registro;
  },

  async findAllByFechaYFinca({ fechas, fincaIds }) {
    return ProgramacionCorte.findAll({
      where: {
        fecha: { [Op.in]: fechas },
        fincaId: { [Op.in]: fincaIds },
      },
      raw: true,
    });
  },

  // Borrado FÍSICO (force: true) de toda la programación de una semana —
  // usado solo por la sincronización con Logística, que reemplaza el
  // contenido completo de la semana en cada corrida (ver
  // programacionCorteService.syncFromBanarica). No puede ser soft-delete: el
  // UNIQUE (fecha, finca_id, producto_id) no ignora filas con deleted_at, así
  // que una fila "borrada" lógicamente seguiría bloqueando el INSERT nuevo.
  deleteBySemana(semanaId, { transaction } = {}) {
    return ProgramacionCorte.destroy({ where: { semanaId }, force: true, transaction });
  },

  // Suma (cajas_programadas × peso_neto del producto) agrupado por
  // finca+semana — la hace la propia base de datos en una sola consulta,
  // sin importar cuántas filas de Programación de Corte haya, para
  // recalcular Producción Semanal (ver
  // programacionCorteService.recalcularProduccionSemanal). Sin
  // `fincaId`/`semanaId` trae TODAS las combinaciones (usado al cambiar la
  // tasa de conversión, que afecta a toda la historia).
  //
  // Solo cuenta días hasta ayer (fecha < hoy): Programación de Corte es un
  // PLAN que puede traer días futuros ya cargados (la semana completa se
  // sincroniza de una), pero "Producción Semanal"/"Cajas Producidas" debe
  // reflejar lo ya cortado, no lo programado a futuro que todavía no pasó.
  async sumarPesoPorFincaYSemana({ fincaId, semanaId } = {}) {
    const condiciones = ['pc.deleted_at IS NULL', 'pc.fecha < CURDATE()'];
    const replacements = {};
    if (fincaId) {
      condiciones.push('pc.finca_id = :fincaId');
      replacements.fincaId = fincaId;
    }
    if (semanaId) {
      condiciones.push('pc.semana_id = :semanaId');
      replacements.semanaId = semanaId;
    }

    return sequelize.query(
      `SELECT pc.finca_id AS fincaId, pc.semana_id AS semanaId,
              SUM(pc.cajas_programadas * COALESCE(p.peso_neto, 0)) AS totalPeso
       FROM programacion_corte pc
       LEFT JOIN productos p ON p.id = pc.producto_id
       WHERE ${condiciones.join(' AND ')}
       GROUP BY pc.finca_id, pc.semana_id`,
      { replacements, type: QueryTypes.SELECT },
    );
  },
};

export default programacionCorteRepository;
