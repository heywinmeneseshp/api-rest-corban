import { Op, fn, col } from 'sequelize';
import { EstimacionFinca, Finca, Semana, User } from '../../database/associations.js';

const listIncludes = [
  { model: Finca, as: 'finca', attributes: ['id', 'uuid', 'codigo', 'nombre'] },
  { model: Semana, as: 'semana', attributes: ['id', 'uuid', 'codigo', 'anio', 'numeroSemana'] },
  { model: User, as: 'creadoPor', attributes: ['id', 'uuid', 'usuario', 'nombre', 'apellido'] },
];

export const estimacionFincaRepository = {
  async findAndCountAll({ limit, offset, fincaIds, semanaId, creadoPorUserId }) {
    const where = {
      ...(fincaIds ? { fincaId: { [Op.in]: fincaIds } } : {}),
      ...(semanaId ? { semanaId } : {}),
      ...(creadoPorUserId ? { createdBy: creadoPorUserId } : {}),
    };

    return EstimacionFinca.findAndCountAll({
      where,
      include: listIncludes,
      limit,
      offset,
      order: [
        [{ model: Semana, as: 'semana' }, 'anio', 'DESC'],
        [{ model: Semana, as: 'semana' }, 'numeroSemana', 'DESC'],
        ['fincaId', 'ASC'],
      ],
      distinct: true,
    });
  },

  // Inserta las que no existen y sobrescribe `cajas20kg` de las que ya
  // existen para esa finca+semana+usuario+registro (índice único incluye
  // semana_registro_id). Restaura la fila si quedó soft-deleted.
  bulkUpsert(dataArray, { transaction } = {}) {
    return EstimacionFinca.bulkCreate(
      dataArray.map((d) => ({ ...d, deletedAt: null, deletedBy: null })),
      {
        updateOnDuplicate: ['cajas20kg', 'observaciones', 'updatedBy', 'deletedAt', 'deletedBy'],
        transaction,
      },
    );
  },

  findByUuid(uuid) {
    return EstimacionFinca.findOne({ where: { uuid }, include: listIncludes });
  },

  // Para el cargue masivo histórico: inserta solo las nuevas, sin tocar
  // las ya existentes (clave única ahora es semana+finca+usuario+registro).
  bulkCreate(dataArray, { transaction } = {}) {
    return EstimacionFinca.bulkCreate(dataArray, { transaction });
  },

  async findAllBySemanaYFinca({ semanaIds, fincaIds, createdBy, semanaRegistroIds }) {
    if (!semanaIds?.length || !fincaIds?.length) return [];
    return EstimacionFinca.findAll({
      where: {
        semanaId: { [Op.in]: semanaIds },
        fincaId: { [Op.in]: fincaIds },
        ...(createdBy ? { createdBy } : {}),
        ...(semanaRegistroIds?.length ? { semanaRegistroId: { [Op.in]: semanaRegistroIds } } : {}),
      },
      attributes: ['id', 'semanaId', 'fincaId', 'createdBy', 'semanaRegistroId'],
      raw: true,
    });
  },

  // Todas las estimaciones (sin paginar) para la vista escalera — agrupadas
  // por semana_registro_id (histórico por registro). Ya no se infiere por timestamp.
  async findForEscalera({ fincaIds, creadoPorUserId }) {
    const where = {
      ...(fincaIds ? { fincaId: { [Op.in]: fincaIds } } : {}),
      ...(creadoPorUserId ? { createdBy: creadoPorUserId } : {}),
    };
    return EstimacionFinca.findAll({
      where,
      include: listIncludes,
      attributes: ['id', 'uuid', 'semanaId', 'fincaId', 'semanaRegistroId', 'cajas20kg', 'createdBy'],
      order: [[{ model: Semana, as: 'semana' }, 'fechaInicio', 'ASC']],
    });
  },

  // Cajas estimadas agregadas por finca+semana+semana de registro, para
  // VARIAS semanas de registro a la vez (ej. un rango 37→38, ver vista
  // pivote/compacta): agrupa también por semanaRegistroId, porque una
  // misma semana objetivo puede repetirse en las ventanas de más de una
  // semana de registro (37 y 38 ambas proyectan la semana 39, por
  // ejemplo) y no hay que sumarlas juntas.
  async getCajasPorFincaSemanaYRegistro({ fincaIds, semanaIds, semanaRegistroIds, creadoPorUserId }) {
    if (!semanaIds?.length || !semanaRegistroIds?.length) return new Map();
    const results = await EstimacionFinca.findAll({
      where: {
        semanaId: { [Op.in]: semanaIds },
        semanaRegistroId: { [Op.in]: semanaRegistroIds },
        ...(fincaIds ? { fincaId: { [Op.in]: fincaIds } } : {}),
        ...(creadoPorUserId ? { createdBy: creadoPorUserId } : {}),
      },
      attributes: ['fincaId', 'semanaId', 'semanaRegistroId', [fn('SUM', col('cajas_20kg')), 'total']],
      group: ['fincaId', 'semanaId', 'semanaRegistroId'],
      raw: true,
    });
    const map = new Map();
    for (const r of results) map.set(`${r.fincaId}-${r.semanaRegistroId}-${r.semanaId}`, Number(r.total));
    return map;
  },

  // Observación (una por finca, no por semana) guardada en cada semana de
  // registro dada — usada por la vista pivote/compacta para mostrar el
  // detalle sin repetir la columna 8 veces. Si una finca tiene varias filas
  // con observaciones distintas dentro de la MISMA semana de registro (no
  // debería, el frontend siempre las guarda iguales), se queda con la
  // primera no vacía que encuentre.
  async getObservacionesPorFincaYRegistro({ fincaIds, semanaRegistroIds }) {
    if (!semanaRegistroIds?.length) return new Map();
    const results = await EstimacionFinca.findAll({
      where: {
        semanaRegistroId: { [Op.in]: semanaRegistroIds },
        ...(fincaIds ? { fincaId: { [Op.in]: fincaIds } } : {}),
        observaciones: { [Op.ne]: null },
      },
      attributes: ['fincaId', 'semanaRegistroId', 'observaciones'],
      raw: true,
    });
    const map = new Map();
    for (const r of results) {
      const clave = `${r.fincaId}-${r.semanaRegistroId}`;
      if (!map.has(clave)) map.set(clave, r.observaciones);
    }
    return map;
  },

  async softDelete(registro, deletedBy, { transaction } = {}) {
    await registro.update({ deletedBy }, { transaction });
    await registro.destroy({ transaction });
    return registro;
  },
};

export default estimacionFincaRepository;
