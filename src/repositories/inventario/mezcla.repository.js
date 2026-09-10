import { Op, literal } from 'sequelize';
import {
  Mezcla,
  MezclaVersion,
  MezclaComponente,
  MezclaEtapa,
  MezclaFoto,
  Articulo,
  UnidadMedida,
  Almacen,
  Elaboracion,
  User,
} from '../../database/associations.js';

const LIST_INCLUDE = [
  { model: Articulo, as: 'articuloElaborado', attributes: ['uuid', 'nombre', 'codigo'] },
  { model: UnidadMedida, as: 'unidadRendimiento', attributes: ['uuid', 'nombre', 'simbolo'] },
  // Solo la versión activa (costo actual + estado de la prueba) — para
  // mostrarla en el listado sin traer todo el historial de etapas/fotos.
  {
    model: MezclaVersion,
    as: 'versiones',
    where: { activa: true },
    required: false,
    separate: true,
    attributes: ['uuid', 'version', 'costoTotal', 'costoUnitario', 'estadoPrueba', 'phFinal', 'ceFinal', 'created_at'],
    include: [{ model: User, as: 'operador', attributes: ['uuid', 'usuario', 'nombre', 'apellido'] }],
  },
];

const VERSION_DETAIL_INCLUDE = [
  {
    model: MezclaComponente,
    as: 'componentes',
    include: [
      // unidadMedidaId: necesario para convertir la cantidad del componente
      // a la unidad base del artículo antes de descontar inventario (ver
      // unidadConversion.js#convertirACantidadBase, usado en finalizar()).
      { model: Articulo, as: 'articulo', attributes: ['uuid', 'nombre', 'codigo', 'costoCompra', 'unidadMedidaId'] },
      { model: UnidadMedida, as: 'unidad', attributes: ['uuid', 'nombre', 'simbolo', 'codigo'] },
    ],
  },
  {
    model: MezclaEtapa,
    as: 'etapas',
    separate: true,
    order: [['numero', 'ASC']],
    include: [
      { model: MezclaComponente, as: 'componente', include: [{ model: Articulo, as: 'articulo', attributes: ['uuid', 'nombre'] }] },
      { model: User, as: 'creadoPor', attributes: ['uuid', 'usuario'] },
      { model: MezclaFoto, as: 'fotos' },
    ],
  },
  {
    model: MezclaFoto,
    as: 'fotos',
    separate: true,
    where: { mezclaEtapaId: null },
    required: false,
  },
  { model: Almacen, as: 'almacen', attributes: ['uuid', 'nombre', 'codigo'] },
  { model: User, as: 'operador', attributes: ['uuid', 'usuario', 'nombre', 'apellido'] },
  { model: Elaboracion, as: 'elaboracionGenerada', attributes: ['uuid', 'documento'] },
];

const DETAIL_INCLUDE = [
  {
    model: Articulo,
    as: 'articuloElaborado',
    attributes: ['uuid', 'nombre', 'codigo', 'costoCompra', 'precioVenta'],
    // Unidad real del producto (la que se eligió al crearlo en
    // crearElaborado) — unidadRendimiento de abajo es un campo legado que
    // el flujo actual no asigna.
    include: [{ model: UnidadMedida, as: 'unidadMedida', attributes: ['uuid', 'nombre', 'simbolo'] }],
  },
  { model: UnidadMedida, as: 'unidadRendimiento', attributes: ['uuid', 'nombre', 'simbolo', 'codigo'] },
  { model: User, as: 'creadoPor', attributes: ['uuid', 'usuario'] },
  { model: User, as: 'actualizadoPor', attributes: ['uuid', 'usuario'] },
  {
    model: MezclaVersion,
    as: 'versiones',
    separate: false,
    order: [['version', 'DESC']],
    include: VERSION_DETAIL_INCLUDE,
  },
];

// Prioridad de la lista: pruebas ÓPTIMAS que todavía no generaron su
// artículo elaborado van primero (pedido explícito — son las que necesitan
// atención: "Crear elaborado" pendiente). `versiones` va con `separate:
// true` en LIST_INCLUDE (consulta aparte, no JOIN), así que no se puede
// ordenar por su estadoPrueba directamente — se resuelve con una subquery
// correlacionada contra la versión activa de cada mezcla.
const ORDEN_PRIORIDAD_OPTIMA_SIN_ELABORAR = literal(`(
  SELECT CASE WHEN mv.estado_prueba = 'OPTIMA' AND \`Mezcla\`.\`articulo_elaborado_id\` IS NULL THEN 0 ELSE 1 END
  FROM mezcla_versiones mv
  WHERE mv.mezcla_id = \`Mezcla\`.\`id\` AND mv.activa = 1
  LIMIT 1
)`);

export const mezclaRepository = {
  async findAndCountAll({ limit, offset, search, estado, articuloElaboradoUuid }) {
    const where = {
      ...(search
        ? {
            [Op.or]: [
              { nombre: { [Op.like]: `%${search}%` } },
              { codigo: { [Op.like]: `%${search}%` } },
            ],
          }
        : {}),
      ...(estado !== undefined ? { estado } : {}),
    };

    if (articuloElaboradoUuid) {
      const prod = await Articulo.findOne({ where: { uuid: articuloElaboradoUuid } });
      where.articuloElaboradoId = prod ? prod.id : -1;
    }

    return Mezcla.findAndCountAll({
      where,
      limit,
      offset,
      order: [
        [ORDEN_PRIORIDAD_OPTIMA_SIN_ELABORAR, 'ASC'],
        ['nombre', 'ASC'],
      ],
      include: LIST_INCLUDE,
      distinct: true,
    });
  },

  // `transaction` es necesario cuando se llama justo después de crear/
  // actualizar dentro de la misma transacción (create/update en el
  // service) — sin pasarla, esta consulta corre en otra conexión y, según
  // el nivel de aislamiento, puede no ver todavía la fila recién escrita.
  findByUuid(uuid, { transaction } = {}) {
    return Mezcla.findOne({ where: { uuid }, include: DETAIL_INCLUDE, transaction });
  },

  findByNombre(nombre) {
    return Mezcla.findOne({ where: { nombre } });
  },

  findByCodigo(codigo) {
    if (!codigo) return null;
    return Mezcla.findOne({ where: { codigo } });
  },

  create(data, { transaction } = {}) {
    return Mezcla.create(data, { transaction });
  },

  async update(mezcla, data, { transaction } = {}) {
    await mezcla.update(data, { transaction });
    return mezcla;
  },

  async softDelete(mezcla, deletedBy, { transaction } = {}) {
    await mezcla.update({ deletedBy }, { transaction });
    await mezcla.destroy({ transaction });
    return mezcla;
  },

  // ─── Versiones (pruebas de laboratorio) ───

  // Historial de pruebas a través de TODAS las mezclas (no solo la versión
  // activa) — usado por la vista de Historial con filtros de fecha,
  // operador, estado, producto elaborado generado y componente utilizado.
  async findVersionesAndCountAll({
    limit,
    offset,
    estadoPrueba,
    operadorUuid,
    fechaDesde,
    fechaHasta,
    articuloElaboradoUuid,
    articuloComponenteUuid,
  }) {
    const where = {};

    if (estadoPrueba) where.estadoPrueba = estadoPrueba;

    if (fechaDesde || fechaHasta) {
      where.created_at = {};
      if (fechaDesde) where.created_at[Op.gte] = fechaDesde;
      if (fechaHasta) where.created_at[Op.lte] = fechaHasta;
    }

    if (operadorUuid) {
      const op = await User.findOne({ where: { uuid: operadorUuid } });
      where.createdBy = op ? op.id : -1;
    }

    if (articuloElaboradoUuid) {
      const prod = await Articulo.findOne({ where: { uuid: articuloElaboradoUuid } });
      const mezclaIds = prod
        ? (await Mezcla.findAll({ where: { articuloElaboradoId: prod.id }, attributes: ['id'] })).map((m) => m.id)
        : [];
      where.mezclaId = mezclaIds.length ? { [Op.in]: mezclaIds } : -1;
    }

    if (articuloComponenteUuid) {
      const art = await Articulo.findOne({ where: { uuid: articuloComponenteUuid } });
      const versionIds = art
        ? (await MezclaComponente.findAll({ where: { articuloId: art.id }, attributes: ['mezclaVersionId'] })).map(
            (c) => c.mezclaVersionId,
          )
        : [];
      where.id = versionIds.length ? { [Op.in]: [...new Set(versionIds)] } : -1;
    }

    return MezclaVersion.findAndCountAll({
      where,
      limit,
      offset,
      order: [['created_at', 'DESC']],
      distinct: true,
      include: [
        { model: Mezcla, as: 'mezcla', include: [{ model: Articulo, as: 'articuloElaborado', attributes: ['uuid', 'nombre', 'codigo'] }] },
        { model: User, as: 'operador', attributes: ['uuid', 'usuario', 'nombre', 'apellido'] },
        { model: Almacen, as: 'almacen', attributes: ['uuid', 'nombre', 'codigo'] },
        { model: Elaboracion, as: 'elaboracionGenerada', attributes: ['uuid', 'documento'] },
        {
          model: MezclaComponente,
          as: 'componentes',
          include: [{ model: Articulo, as: 'articulo', attributes: ['uuid', 'nombre', 'codigo'] }],
        },
      ],
    });
  },

  findVersionByUuid(uuid, { transaction } = {}) {
    return MezclaVersion.findOne({
      where: { uuid },
      include: [{ model: Mezcla, as: 'mezcla', include: LIST_INCLUDE }, ...VERSION_DETAIL_INCLUDE],
      transaction,
    });
  },

  findActiveVersion(mezclaId, { transaction } = {}) {
    return MezclaVersion.findOne({ where: { mezclaId, activa: true }, order: [['version', 'DESC']], transaction });
  },

  updateVersion(version, data, { transaction } = {}) {
    return version.update(data, { transaction });
  },

  // ─── Componentes de una versión (en edición libre mientras la prueba
  // está en BORRADOR/EN_PRUEBA — ver mezcla.service.js#setComponentes) ───

  findComponentesByVersionId(mezclaVersionId, { transaction } = {}) {
    return MezclaComponente.findAll({ where: { mezclaVersionId }, transaction });
  },

  destroyComponentesByVersionId(mezclaVersionId, { transaction } = {}) {
    return MezclaComponente.destroy({ where: { mezclaVersionId }, transaction });
  },

  createComponente(data, { transaction } = {}) {
    return MezclaComponente.create(data, { transaction });
  },

  // ─── Etapas ───

  countEtapas(mezclaVersionId, { transaction } = {}) {
    return MezclaEtapa.count({ where: { mezclaVersionId }, transaction });
  },

  createEtapa(data, { transaction } = {}) {
    return MezclaEtapa.create(data, { transaction });
  },

  findUltimaEtapa(mezclaVersionId, { transaction } = {}) {
    return MezclaEtapa.findOne({ where: { mezclaVersionId }, order: [['numero', 'DESC']], transaction });
  },

  findEtapaByUuid(uuid) {
    return MezclaEtapa.findOne({ where: { uuid } });
  },

  findEtapasByVersionId(mezclaVersionId, { transaction } = {}) {
    return MezclaEtapa.findAll({ where: { mezclaVersionId }, order: [['numero', 'ASC']], transaction });
  },

  destroyEtapa(etapa, { transaction } = {}) {
    return etapa.destroy({ transaction });
  },

  updateEtapa(etapa, data, { transaction } = {}) {
    return etapa.update(data, { transaction });
  },

  // ─── Fotos ───

  createFoto(data, { transaction } = {}) {
    return MezclaFoto.create(data, { transaction });
  },

  findFotoByUuid(uuid) {
    return MezclaFoto.findOne({ where: { uuid } });
  },

  destroyFoto(foto) {
    return foto.destroy();
  },
};

export default mezclaRepository;
