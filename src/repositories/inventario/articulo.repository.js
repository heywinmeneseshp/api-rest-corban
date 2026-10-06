import { Op } from 'sequelize';
import { Articulo, ArticuloCategoria, UnidadMedida, Almacen, ArticuloAlmacen, IngredienteActivo } from '../../database/associations.js';

const INCLUDE = [
  { model: ArticuloCategoria, as: 'categoria', attributes: ['uuid', 'nombre', 'tipo'] },
  { model: UnidadMedida, as: 'unidadMedida', attributes: ['uuid', 'nombre', 'simbolo', 'codigo'] },
  { model: UnidadMedida, as: 'dosisUnidad', attributes: ['uuid', 'nombre', 'simbolo'] },
  { model: Almacen, as: 'almacenes', attributes: ['uuid', 'nombre', 'codigo'], through: { attributes: [] } },
  { model: IngredienteActivo, as: 'ingredientesActivos', attributes: ['uuid', 'nombre'], through: { attributes: [] } },
];

export const articuloRepository = {
  async findAndCountAll({
    limit,
    offset,
    search,
    tipo,
    categoriaUuid,
    unidadMedidaUuid,
    estado,
    manejaInventario,
    almacenUuid,
    almacenIdsPermitidos,
  }) {
    const where = {
      ...(search ? { [Op.or]: [{ codigo: { [Op.like]: `%${search}%` } }, { nombre: { [Op.like]: `%${search}%` } }] } : {}),
      ...(estado !== undefined ? { estado } : {}),
      ...(manejaInventario !== undefined ? { manejaInventario } : {}),
    };
    // El artículo ya no tiene su propio `tipo` — filtra por el de su
    // categoría (join). `subQuery: false` para que el filtro sobre la
    // tabla incluida se aplique antes del LIMIT (si no, Sequelize pagina
    // primero y el filtro no encuentra nada).
    if (tipo) where['$categoria.tipo$'] = tipo;

    if (categoriaUuid) {
      const cat = await ArticuloCategoria.findOne({ where: { uuid: categoriaUuid } });
      where.categoriaId = cat ? cat.id : -1;
    }
    if (unidadMedidaUuid) {
      const uni = await UnidadMedida.findOne({ where: { uuid: unidadMedidaUuid } });
      where.unidadMedidaId = uni ? uni.id : -1;
    }

    // Visibilidad por almacén (ver utils/almacenScope.js): un artículo SIN
    // ningún almacén asignado es visible en todos — así que el filtro es
    // "no tiene ninguno" OR "tiene alguno de los permitidos". Se resuelve
    // con una subquery (en vez de un LEFT JOIN + distinct) para no alterar
    // el INCLUDE de `almacenes` que ya se usa para mostrar la lista.
    const almacenesAPermitir = await resolverAlmacenesFiltro(almacenUuid, almacenIdsPermitidos);
    if (almacenesAPermitir) {
      where[Op.and] = [
        ...(where[Op.and] || []),
        {
          [Op.or]: [
            { '$almacenes.id$': null },
            { '$almacenes.id$': { [Op.in]: almacenesAPermitir } },
          ],
        },
      ];
    }

    return Articulo.findAndCountAll({
      where,
      limit,
      offset,
      order: [['nombre', 'ASC']],
      include: INCLUDE,
      subQuery: false,
      distinct: true,
    });
  },

  setAlmacenes(articulo, almacenIds, createdBy, { transaction } = {}) {
    return articulo.setAlmacenes(almacenIds, { through: { createdBy }, transaction });
  },

  setIngredientesActivos(articulo, ingredientesActivoIds, createdBy, { transaction } = {}) {
    return articulo.setIngredientesActivos(ingredientesActivoIds, { through: { createdBy }, transaction });
  },

  // Ids (no uuids) de los almacenes asignados a un artículo — consulta
  // liviana para el chequeo de visibilidad (ver
  // articulo.service.js#getByUuid), sin traer el modelo Almacen completo.
  async findAlmacenIdsByArticuloId(articuloId) {
    const filas = await ArticuloAlmacen.findAll({ where: { articuloId }, attributes: ['almacenId'], raw: true });
    return filas.map((f) => f.almacenId);
  },

  findByUuid(uuid) {
    return Articulo.findOne({ where: { uuid }, include: INCLUDE });
  },

  // Solo artículos eliminados lógicamente (deleted_at no nulo) — para la
  // papelera, restringida al rol Administrador (ver requireAdmin en la
  // ruta).
  async findAndCountAllDeleted({ limit, offset, search, categoriaId }) {
    const where = {
      deletedAt: { [Op.ne]: null },
      ...(search ? { [Op.or]: [{ codigo: { [Op.like]: `%${search}%` } }, { nombre: { [Op.like]: `%${search}%` } }] } : {}),
      ...(categoriaId ? { categoriaId } : {}),
    };
    return Articulo.findAndCountAll({
      where,
      limit,
      offset,
      order: [['deletedAt', 'DESC']],
      include: INCLUDE,
      paranoid: false,
    });
  },

  findByNombre(nombre) {
    return Articulo.findOne({ where: { nombre } });
  },

  findByNombreIncludingDeleted(nombre) {
    return Articulo.findOne({ where: { nombre }, paranoid: false });
  },

  findByUuidIncludingDeleted(uuid) {
    return Articulo.findOne({ where: { uuid }, paranoid: false });
  },

  async restore(articulo, { transaction } = {}) {
    await articulo.restore({ transaction });
    await articulo.update({ deletedBy: null }, { transaction });
    return articulo;
  },

  findByNombres(nombres) {
    if (!nombres || nombres.length === 0) return [];
    return Articulo.findAll({ where: { nombre: { [Op.in]: nombres } } });
  },

  // Inserta los nuevos y actualiza los existentes (por nombre, que es
  // único) en una sola sentencia SQL, en vez de una consulta por fila —
  // para el cargue masivo.
  bulkUpsert(rows) {
    return Articulo.bulkCreate(rows, {
      updateOnDuplicate: [
        'codigo',
        'descripcion',
        'categoriaId',
        'unidadMedidaId',
        'costoCompra',
        'precioVenta',
        'manejaInventario',
        'stockMinimo',
        'stockMaximo',
        'estado',
        'updatedBy',
      ],
    });
  },

  create(data, { transaction } = {}) {
    return Articulo.create(data, { transaction });
  },

  async update(articulo, data, { transaction } = {}) {
    await articulo.update(data, { transaction });
    return articulo;
  },

  async softDelete(articulo, deletedBy, { transaction } = {}) {
    await articulo.update({ deletedBy }, { transaction });
    await articulo.destroy({ transaction });
    return articulo;
  },
};

// Combina el filtro explícito `?almacenUuid=X` (selectores que ya tienen un
// almacén elegido) con los almacenes permitidos del usuario (scope), y
// devuelve la lista final de ids a permitir, o `null` si no hay que filtrar
// en absoluto (ningún almacén puntual pedido y usuario sin restricción).
async function resolverAlmacenesFiltro(almacenUuid, almacenIdsPermitidos) {
  let almacenIdPedido;
  if (almacenUuid) {
    const alm = await Almacen.findOne({ where: { uuid: almacenUuid } });
    almacenIdPedido = alm ? alm.id : -1;
  }

  if (almacenIdPedido !== undefined && almacenIdsPermitidos !== null && almacenIdsPermitidos !== undefined) {
    return almacenIdsPermitidos.includes(almacenIdPedido) ? [almacenIdPedido] : [-1];
  }
  if (almacenIdPedido !== undefined) return [almacenIdPedido];
  if (almacenIdsPermitidos !== null && almacenIdsPermitidos !== undefined) return almacenIdsPermitidos;
  return null;
}

export default articuloRepository;
