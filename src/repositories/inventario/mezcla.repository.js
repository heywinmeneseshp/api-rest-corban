import { Op, literal } from 'sequelize';
import {
  Mezcla,
  MezclaVersion,
  MezclaComponente,
  MezclaEtapa,
  MezclaFoto,
  MezclaHomogeneidad,
  Articulo,
  UnidadMedida,
  Almacen,
  Elaboracion,
  User,
  Role,
} from '../../database/associations.js';

// Usuario + sus roles (el "cargo" que se muestra en el detalle: quién creó
// / finalizó / aprobó la prueba).
const usuarioConRoles = (as) => ({
  model: User,
  as,
  attributes: ['uuid', 'usuario', 'nombre', 'apellido'],
  include: [{ model: Role, as: 'roles', attributes: ['uuid', 'nombre'], through: { attributes: [] } }],
});

const LIST_INCLUDE = [
  // 'estado': el frontend (Elaboraciones → Nueva elaboración) filtra por
  // esto para no ofrecer un elaborado todavía inactivo (pendiente de
  // aprobación) como opción para producir más.
  { model: Articulo, as: 'articuloElaborado', attributes: ['uuid', 'nombre', 'codigo', 'estado'] },
  { model: UnidadMedida, as: 'unidadRendimiento', attributes: ['uuid', 'nombre', 'simbolo'] },
  // Unidad de dosisPorHectarea — la usa Sanidad Vegetal → Programación de
  // Aspersiones para mostrar/calcular en la unidad correcta (puede ser
  // distinta de unidadRendimiento).
  { model: UnidadMedida, as: 'dosisPorHectareaUnidad', attributes: ['uuid', 'nombre', 'simbolo'] },
  // Solo la versión activa (costo actual + estado de la prueba) — para
  // mostrarla en el listado sin traer todo el historial de etapas/fotos.
  {
    model: MezclaVersion,
    as: 'versiones',
    where: { activa: true },
    required: false,
    separate: true,
    // 'esDirecta': el frontend de Elaboraciones lo usa para mostrar como
    // "receta sin producir" una mezcla creada con crearDirecta() que
    // todavía no generó ningún documento ELAB-000X.
    attributes: ['uuid', 'version', 'costoTotal', 'costoUnitario', 'estadoPrueba', 'phFinal', 'ceFinal', 'created_at', 'esDirecta'],
    include: [
      { model: User, as: 'operador', attributes: ['uuid', 'usuario', 'nombre', 'apellido'] },
      { model: Almacen, as: 'almacen', attributes: ['uuid', 'nombre', 'codigo'] },
    ],
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
      // 'id': lo usa consumirStockConReceta (stock.helper.js) para resolver
      // si este artículo es a su vez un elaborado — sin `id` en la lista,
      // `comp.articulo.id` queda undefined y rompe esa consulta.
      {
        model: Articulo,
        as: 'articulo',
        // dosisMaximaPorHectarea/dosisMaximaUnidadId: dosis máxima de
        // referencia del insumo (categoría INSUMO, ver articulo.model.js) —
        // Programación de Aspersiones la usa para alertar si lo que se va a
        // aplicar la supera. manejaInventario: lo necesita
        // consumirStockConReceta (stock.helper.js) para saltear por
        // completo el descuento de un artículo como el Agua.
        attributes: ['id', 'uuid', 'nombre', 'codigo', 'costoCompra', 'unidadMedidaId', 'dosisMaximaPorHectarea', 'manejaInventario'],
        include: [{ model: UnidadMedida, as: 'dosisMaximaUnidad', attributes: ['uuid', 'nombre', 'simbolo'] }],
      },
      { model: UnidadMedida, as: 'unidad', attributes: ['uuid', 'nombre', 'simbolo', 'codigo'] },
    ],
  },
  {
    model: MezclaEtapa,
    as: 'etapas',
    separate: true,
    order: [['numero', 'ASC']],
    include: [
      {
        model: MezclaComponente,
        as: 'componente',
        include: [
          { model: Articulo, as: 'articulo', attributes: ['uuid', 'nombre'] },
          { model: UnidadMedida, as: 'unidad', attributes: ['uuid', 'nombre', 'simbolo'] },
        ],
      },
      {
        // attributes completos (no solo uuid/nombre/codigo): consumirStockConReceta
        // (stock.helper.js) necesita id/unidadMedidaId/costoCompra/manejaInventario
        // para descontar esta corrección de pH al finalizar la prueba.
        model: Articulo,
        as: 'articuloCorreccion',
        attributes: ['id', 'uuid', 'nombre', 'codigo', 'costoCompra', 'unidadMedidaId', 'manejaInventario'],
      },
      { model: UnidadMedida, as: 'unidadCorreccion', attributes: ['uuid', 'nombre', 'simbolo'] },
      { model: User, as: 'creadoPor', attributes: ['uuid', 'usuario'] },
      { model: MezclaFoto, as: 'fotos' },
    ],
  },
  {
    model: MezclaFoto,
    as: 'fotos',
    separate: true,
    // Excluye tanto las fotos de una etapa puntual como las de un punto de
    // control de homogeneidad — esas se muestran en sus propias secciones
    // (ver 'etapas' arriba y 'homogeneidad' abajo), acá solo la evidencia
    // general suelta.
    where: { mezclaEtapaId: null, mezclaHomogeneidadId: null },
    required: false,
  },
  {
    model: MezclaHomogeneidad,
    as: 'homogeneidad',
    separate: true,
    include: [
      { model: MezclaFoto, as: 'fotos' },
      { model: User, as: 'creadoPor', attributes: ['uuid', 'usuario'] },
    ],
  },
  { model: Almacen, as: 'almacen', attributes: ['uuid', 'nombre', 'codigo'] },
  usuarioConRoles('operador'),
  usuarioConRoles('finalizadaPor'),
  usuarioConRoles('aprobadaPor'),
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
  { model: UnidadMedida, as: 'dosisPorHectareaUnidad', attributes: ['uuid', 'nombre', 'simbolo', 'codigo'] },
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
  async findAndCountAll({ limit, offset, search, estado, articuloElaboradoUuid, incluirDirectas = true }) {
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

    // "Mezclas — Pruebas de laboratorio" (incluirDirectas: false) no debe
    // mostrar recetas creadas con crearDirecta() — nunca pasaron por la
    // prueba de pH/CE, así que no son "pruebas de laboratorio" (pedido
    // explícito). El resto de los usos de este listado (ej. el selector de
    // Elaboraciones) sigue viendo todas, por eso el filtro es opt-in.
    if (incluirDirectas === false) {
      const directas = await MezclaVersion.findAll({ where: { activa: true, esDirecta: true }, attributes: ['mezclaId'] });
      const idsExcluidos = directas.map((v) => v.mezclaId);
      if (idsExcluidos.length) {
        where.id = { [Op.notIn]: idsExcluidos };
      }
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

  // UUIDs de los roles de un usuario — para el chequeo de aprobación de
  // pruebas de mezcla (roles autorizados en Configuración → Parámetros).
  async findRolUuidsByUserId(userId) {
    const u = await User.findByPk(userId, {
      include: [{ model: Role, as: 'roles', attributes: ['uuid'], through: { attributes: [] } }],
    });
    return (u?.roles || []).map((r) => r.uuid);
  },

  // ─── Componentes de una versión (en edición libre mientras la prueba
  // está en BORRADOR/EN_PRUEBA — ver mezcla.service.js#setComponentes) ───

  destroyComponentesByVersionId(mezclaVersionId, { transaction } = {}) {
    return MezclaComponente.destroy({ where: { mezclaVersionId }, transaction });
  },

  createComponente(data, { transaction } = {}) {
    return MezclaComponente.create(data, { transaction });
  },

  findComponenteByUuid(uuid, { transaction } = {}) {
    return MezclaComponente.findOne({ where: { uuid }, transaction });
  },

  // Actualiza una fila EN EL LUGAR (preserva su id) — a diferencia de
  // destroyComponentesByVersionId + createComponente, esto no invalida el
  // `componenteId` que ya pueda tener guardado una MezclaEtapa apuntando a
  // esta fila (ver mezcla.service.js#actualizarComponente/agregarComponente).
  updateComponente(componente, data, { transaction } = {}) {
    return componente.update(data, { transaction });
  },

  // ─── Etapas ───

  countEtapas(mezclaVersionId, { transaction } = {}) {
    return MezclaEtapa.count({ where: { mezclaVersionId }, transaction });
  },

  createEtapa(data, { transaction } = {}) {
    return MezclaEtapa.create(data, { transaction });
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

  // ─── Prueba de homogeneidad ───

  findHomogeneidadByVersionEIntervalo(mezclaVersionId, intervalo, { transaction } = {}) {
    return MezclaHomogeneidad.findOne({ where: { mezclaVersionId, intervalo }, transaction });
  },

  createHomogeneidad(data, { transaction } = {}) {
    return MezclaHomogeneidad.create(data, { transaction });
  },

  updateHomogeneidad(homogeneidad, data, { transaction } = {}) {
    return homogeneidad.update(data, { transaction });
  },
};

export default mezclaRepository;
