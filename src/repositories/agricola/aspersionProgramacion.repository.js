import { Op, fn, col, where as sequelizeWhere } from 'sequelize';
import {
  AspersionProgramacion,
  AspersionProgramacionComponente,
  Finca,
  Semana,
  Mezcla,
  MezclaVersion,
  MezclaComponente,
  Articulo,
  UnidadMedida,
  Almacen,
  User,
} from '../../database/associations.js';

const LIST_INCLUDE = [
  { model: Finca, as: 'finca', attributes: ['uuid', 'nombre', 'codigo'] },
  { model: Semana, as: 'semana', attributes: ['uuid', 'codigo', 'numeroSemana', 'anio'] },
  {
    model: Mezcla,
    as: 'mezcla',
    attributes: ['uuid', 'nombre', 'codigo', 'dosisPorHectarea'],
    include: [
      { model: Articulo, as: 'articuloElaborado', attributes: ['uuid', 'nombre'] },
      { model: UnidadMedida, as: 'unidadRendimiento', attributes: ['uuid', 'nombre', 'simbolo'] },
    ],
  },
  { model: Almacen, as: 'almacen', attributes: ['uuid', 'nombre', 'codigo'] },
  { model: User, as: 'usuario', attributes: ['uuid', 'usuario', 'nombre', 'apellido', 'cargo'] },
];

const DETAIL_INCLUDE = [
  { model: Finca, as: 'finca', attributes: ['uuid', 'nombre', 'codigo'] },
  { model: Semana, as: 'semana', attributes: ['uuid', 'codigo', 'numeroSemana', 'anio'] },
  {
    // Componentes de la receta vigente de la mezcla usada — necesarios para
    // el aviso PDF (insumos) y para ejecutar() (descontar stock).
    model: Mezcla,
    as: 'mezcla',
    // unidadRendimientoId/dosisPorHectareaUnidadId: los necesita
    // aspersionProgramacion.service.js#calcularCantidad para convertir entre
    // la unidad de la dosis y la de rendimiento (pueden ser distintas). 'id':
    // lo necesita #calcularComponentesReceta para buscar la MezclaVersion
    // activa (mezclaId) — sin esto, aspersion.mezcla.id queda undefined y
    // update() rompe al recalcular componentes sin mezclaUuid en el payload.
    attributes: ['id', 'uuid', 'nombre', 'codigo', 'rendimiento', 'unidadRendimientoId', 'dosisPorHectarea', 'dosisPorHectareaUnidadId'],
    include: [
      { model: Articulo, as: 'articuloElaborado', attributes: ['uuid', 'nombre'] },
      { model: UnidadMedida, as: 'unidadRendimiento', attributes: ['uuid', 'nombre', 'simbolo'] },
      { model: UnidadMedida, as: 'dosisPorHectareaUnidad', attributes: ['uuid', 'nombre', 'simbolo'] },
      {
        // Sin `separate: true` acá: a diferencia de mezcla.repository.js
        // (donde Mezcla es el modelo raíz y versiones cuelga directo de
        // ella), acá `mezcla` ya está anidada dentro de `AspersionProgramacion`
        // — un `separate` a ese segundo nivel de profundidad no lo resuelve
        // bien Sequelize (la consulta separada vuelve vacía en silencio, sin
        // error). Como es un JOIN normal contra como mucho una versión
        // activa por mezcla, no hay problema de fan-out.
        model: MezclaVersion,
        as: 'versiones',
        where: { activa: true },
        required: false,
        include: [
          {
            model: MezclaComponente,
            as: 'componentes',
            include: [
              { model: Articulo, as: 'articulo', attributes: ['id', 'uuid', 'nombre', 'codigo', 'costoCompra', 'unidadMedidaId', 'manejaInventario'] },
              { model: UnidadMedida, as: 'unidad', attributes: ['uuid', 'nombre', 'simbolo', 'codigo'] },
            ],
          },
        ],
      },
    ],
  },
  { model: Almacen, as: 'almacen', attributes: ['uuid', 'nombre', 'codigo'] },
  { model: User, as: 'usuario', attributes: ['uuid', 'usuario', 'nombre', 'apellido', 'cargo'] },
  {
    // Snapshot editable por línea de esta aspersión puntual (ver
    // aspersionProgramacionComponente.model.js) — lo que ejecutar()
    // realmente descuenta, distinto de `mezcla.versiones[0].componentes`
    // (la receta "en vivo", que solo se usa para calcular
    // cantidadCalculada al programar/editar).
    model: AspersionProgramacionComponente,
    as: 'componentes',
    include: [
      { model: Articulo, as: 'articulo', attributes: ['id', 'uuid', 'nombre', 'codigo', 'costoCompra', 'unidadMedidaId', 'manejaInventario'] },
      { model: UnidadMedida, as: 'unidad', attributes: ['uuid', 'nombre', 'simbolo', 'codigo'] },
    ],
  },
];

export const aspersionProgramacionRepository = {
  async findAndCountAll({ limit, offset, fincaUuid, semanaUuid, mezclaUuid, estado, tipo, fechaDesde, fechaHasta, search }) {
    const where = {};
    if (estado) where.estado = estado;
    if (fechaDesde || fechaHasta) {
      where.fecha = {};
      if (fechaDesde) where.fecha[Op.gte] = fechaDesde;
      if (fechaHasta) where.fecha[Op.lte] = fechaHasta;
    }
    if (search) where.numero = { [Op.like]: `%${search}%` };

    if (fincaUuid) {
      const finca = await Finca.findOne({ where: { uuid: fincaUuid } });
      where.fincaId = finca ? finca.id : -1;
    }

    if (semanaUuid) {
      const semana = await Semana.findOne({ where: { uuid: semanaUuid } });
      where.semanaId = semana ? semana.id : -1;
    }

    if (mezclaUuid) {
      const mezcla = await Mezcla.findOne({ where: { uuid: mezclaUuid } });
      where.mezclaId = mezcla ? mezcla.id : -1;
    }

    // `tipo` es un array JSON (una aspersión puede marcar varios tipos a la
    // vez) — filtrar por "contiene este tipo" necesita JSON_CONTAINS, un
    // simple `where.tipo = tipo` no sirve contra una columna JSON.
    const andConditions = [];
    if (tipo) {
      // `col('tipo')` a secas queda ambiguo: `Almacen` (joineado como
      // `almacen`) también tiene una columna `tipo` — hay que calificarla
      // con la tabla.
      andConditions.push(sequelizeWhere(fn('JSON_CONTAINS', col('AspersionProgramacion.tipo'), JSON.stringify(tipo)), 1));
    }

    return AspersionProgramacion.findAndCountAll({
      where: andConditions.length ? { [Op.and]: [where, ...andConditions] } : where,
      limit,
      offset,
      order: [['fecha', 'DESC']],
      include: LIST_INCLUDE,
      distinct: true,
    });
  },

  findByUuid(uuid, { transaction } = {}) {
    return AspersionProgramacion.findOne({ where: { uuid }, include: DETAIL_INCLUDE, transaction });
  },

  create(data, { transaction } = {}) {
    return AspersionProgramacion.create(data, { transaction });
  },

  async update(aspersion, data, { transaction } = {}) {
    await aspersion.update(data, { transaction });
    return aspersion;
  },

  async softDelete(aspersion, deletedBy, { transaction } = {}) {
    await aspersion.update({ deletedBy }, { transaction });
    await aspersion.destroy({ transaction });
    return aspersion;
  },

  // Destruye y recrea TODAS las filas de componentes de una aspersión —
  // mismo criterio que mezcla.repository.js usa para MezclaComponente vía
  // setComponentes: se llama solo cuando cambia la mezcla o las hectáreas
  // (lo único que altera qué insumos/cantidades teóricas corresponden), así
  // que no tiene sentido actualizar fila por fila.
  async replaceComponentes(aspersionProgramacionId, filas, { transaction } = {}) {
    await AspersionProgramacionComponente.destroy({ where: { aspersionProgramacionId }, transaction });
    if (!filas.length) return [];
    return AspersionProgramacionComponente.bulkCreate(
      filas.map((f) => ({ ...f, aspersionProgramacionId })),
      { transaction },
    );
  },

  findComponenteByUuid(uuid, { transaction } = {}) {
    return AspersionProgramacionComponente.findOne({ where: { uuid }, transaction });
  },

  async updateComponente(componente, data, { transaction } = {}) {
    await componente.update(data, { transaction });
    return componente;
  },
};

export default aspersionProgramacionRepository;
