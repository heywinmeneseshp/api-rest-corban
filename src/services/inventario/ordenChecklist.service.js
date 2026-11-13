import { Op } from 'sequelize';
import { sequelize } from '../../database/connection.js';
import { ChecklistPlantilla, ChecklistPlantillaItem, Equipo, OrdenChecklistItem, OrdenHallazgo, OrdenMantenimiento, PlanMantenimiento, ProgramacionMantenimiento } from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';

// Checklist y hallazgos de una orden de mantenimiento. El checklist es una copia (snapshot) de la plantilla del plan; cada ítem se califica y, si queda
// en Observación o Insatisfactorio, nace un hallazgo con su acción ejecutada, repuesto pendiente y recomendación. Los hallazgos siguen vivos después de
// cerrar la orden (para el seguimiento) y se pueden convertir en una programación de corrección.
export const CALIFICACIONES = ['SATISFACTORIO', 'OBSERVACION', 'INSATISFACTORIO', 'NA', 'PENDIENTE'];
const NO_SATISFACTORIAS = ['OBSERVACION', 'INSATISFACTORIO'];
const PRIORIDADES = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'];
const ESTADOS_HALLAZGO = ['ABIERTO', 'EN_SEGUIMIENTO', 'RESUELTO'];

async function buscarOrden(uuid, transaction) {
  const o = await OrdenMantenimiento.findOne({ where: { uuid }, transaction });
  if (!o) throw ApiError.notFound('Orden de mantenimiento no encontrada');
  return o;
}

const itemPublico = (i) => ({ uuid: i.uuid, seccion: i.seccion, seccionOrden: i.seccionOrden, orden: i.orden, descripcion: i.descripcion, calificacion: i.calificacion, observaciones: i.observaciones });

const hallazgoPublico = (h, item = null) => ({
  uuid: h.uuid,
  descripcion: h.descripcion,
  calificacion: h.calificacion,
  accionEjecutada: h.accionEjecutada,
  pendienteRepuesto: h.pendienteRepuesto,
  recomendacion: h.recomendacion,
  prioridad: h.prioridad,
  estado: h.estado,
  fechaResolucion: h.fechaResolucion,
  itemUuid: item?.uuid ?? null,
  seccion: item?.seccion ?? null,
  itemDescripcion: item?.descripcion ?? null,
  programacionUuid: h.programacion?.uuid ?? null,
});

const incluirHallazgo = [{ model: ProgramacionMantenimiento, as: 'programacion', attributes: ['uuid', 'fechaProgramada', 'estado'] }];

// Copia los ítems de una plantilla a la orden (dentro de la transacción de quien crea la orden).
export async function copiarDePlantilla(ordenId, plantillaId, transaction) {
  const plantilla = await ChecklistPlantilla.findOne({ where: { id: plantillaId }, transaction });
  if (!plantilla) return 0;
  const items = await ChecklistPlantillaItem.findAll({ where: { plantillaId }, order: [['seccionOrden', 'ASC'], ['orden', 'ASC']], transaction });
  if (items.length === 0) return 0;
  await OrdenChecklistItem.bulkCreate(
    items.map((i) => ({ ordenId, plantillaItemId: i.id, seccion: i.seccion, seccionOrden: i.seccionOrden, orden: i.orden, descripcion: i.descripcion })),
    { transaction },
  );
  return items.length;
}

export const ordenChecklistService = {
  // Checklist + hallazgos de la orden, con un resumen por calificación.
  async obtener(ordenUuid) {
    const orden = await buscarOrden(ordenUuid);
    const items = await OrdenChecklistItem.findAll({ where: { ordenId: orden.id }, order: [['seccionOrden', 'ASC'], ['orden', 'ASC']] });
    const hallazgos = await OrdenHallazgo.findAll({ where: { ordenId: orden.id }, include: incluirHallazgo, order: [['id', 'ASC']] });
    const porId = new Map(items.map((i) => [i.id, i]));
    const resumen = Object.fromEntries(CALIFICACIONES.map((c) => [c, items.filter((i) => i.calificacion === c).length]));
    return { items: items.map(itemPublico), hallazgos: hallazgos.map((h) => hallazgoPublico(h, porId.get(h.checklistItemId))), resumen, total: items.length };
  },

  // Copia el checklist de la plantilla (la indicada o la del plan de la orden). No pisa uno existente.
  async generar(ordenUuid, plantillaUuid) {
    const orden = await buscarOrden(ordenUuid);
    if ((await OrdenChecklistItem.count({ where: { ordenId: orden.id } })) > 0) throw ApiError.conflict('La orden ya tiene checklist');
    let plantillaId = null;
    if (plantillaUuid) {
      const p = await ChecklistPlantilla.findOne({ where: { uuid: plantillaUuid } });
      if (!p) throw ApiError.notFound('Plantilla de checklist no encontrada');
      plantillaId = p.id;
    } else if (orden.planId) {
      plantillaId = (await PlanMantenimiento.findByPk(orden.planId))?.plantillaId ?? null;
    }
    if (!plantillaId) throw ApiError.badRequest('Elige una plantilla: el plan de la orden no tiene una asignada');
    const copiados = await sequelize.transaction((transaction) => copiarDePlantilla(orden.id, plantillaId, transaction));
    if (copiados === 0) throw ApiError.badRequest('La plantilla no tiene ítems');
    return this.obtener(ordenUuid);
  },

  // Califica ítems en lote. Un ítem Observación / Insatisfactorio sin hallazgo genera uno; si cambia entre esos dos, el hallazgo lo sigue.
  async guardarItems(ordenUuid, cambios, user) {
    const orden = await buscarOrden(ordenUuid);
    if (orden.estado === 'CERRADA' || orden.estado === 'CANCELADA') throw ApiError.badRequest('La orden está cerrada: el checklist ya no se puede editar');
    await sequelize.transaction(async (transaction) => {
      for (const c of cambios) {
        const item = await OrdenChecklistItem.findOne({ where: { uuid: c.uuid, ordenId: orden.id }, transaction });
        if (!item) throw ApiError.notFound('Ítem de checklist no encontrado');
        const datos = {};
        if (c.calificacion !== undefined) {
          if (!CALIFICACIONES.includes(c.calificacion)) throw ApiError.badRequest(`Calificación inválida: ${c.calificacion}`);
          datos.calificacion = c.calificacion;
        }
        if (c.observaciones !== undefined) datos.observaciones = c.observaciones ? String(c.observaciones).trim() || null : null;
        await item.update(datos, { transaction });
        if (NO_SATISFACTORIAS.includes(item.calificacion)) {
          const existente = await OrdenHallazgo.findOne({ where: { ordenId: orden.id, checklistItemId: item.id }, transaction });
          if (existente) {
            if (existente.calificacion !== item.calificacion) await existente.update({ calificacion: item.calificacion, updatedBy: user?.id ?? null }, { transaction });
          } else {
            await OrdenHallazgo.create(
              { ordenId: orden.id, checklistItemId: item.id, descripcion: item.observaciones || item.descripcion, calificacion: item.calificacion, prioridad: item.calificacion === 'INSATISFACTORIO' ? 'ALTA' : 'MEDIA', createdBy: user?.id ?? null },
              { transaction },
            );
          }
        }
      }
    });
    return this.obtener(ordenUuid);
  },

  async crearHallazgo(ordenUuid, datos, user) {
    const orden = await buscarOrden(ordenUuid);
    const h = await OrdenHallazgo.create(
      {
        ordenId: orden.id,
        descripcion: String(datos.descripcion).trim(),
        calificacion: NO_SATISFACTORIAS.includes(datos.calificacion) ? datos.calificacion : 'OBSERVACION',
        accionEjecutada: datos.accionEjecutada || null,
        pendienteRepuesto: datos.pendienteRepuesto || null,
        recomendacion: datos.recomendacion || null,
        prioridad: PRIORIDADES.includes(datos.prioridad) ? datos.prioridad : 'MEDIA',
        createdBy: user?.id ?? null,
      },
    );
    return hallazgoPublico(await OrdenHallazgo.findByPk(h.id, { include: incluirHallazgo }));
  },

  async actualizarHallazgo(hallazgoUuid, datos, user) {
    const h = await OrdenHallazgo.findOne({ where: { uuid: hallazgoUuid }, include: incluirHallazgo });
    if (!h) throw ApiError.notFound('Hallazgo no encontrado');
    const cambios = { updatedBy: user?.id ?? null };
    for (const campo of ['descripcion', 'accionEjecutada', 'pendienteRepuesto', 'recomendacion']) if (datos[campo] !== undefined) cambios[campo] = datos[campo] ? String(datos[campo]).trim() || null : null;
    if (cambios.descripcion === null) throw ApiError.badRequest('La descripción del hallazgo no puede quedar vacía');
    if (datos.prioridad !== undefined) {
      if (!PRIORIDADES.includes(datos.prioridad)) throw ApiError.badRequest('Prioridad inválida');
      cambios.prioridad = datos.prioridad;
    }
    if (datos.estado !== undefined) {
      if (!ESTADOS_HALLAZGO.includes(datos.estado)) throw ApiError.badRequest('Estado inválido');
      cambios.estado = datos.estado;
      cambios.fechaResolucion = datos.estado === 'RESUELTO' ? new Date().toISOString().slice(0, 10) : null;
    }
    await h.update(cambios);
    return hallazgoPublico(await OrdenHallazgo.findByPk(h.id, { include: incluirHallazgo }));
  },

  async eliminarHallazgo(hallazgoUuid) {
    const h = await OrdenHallazgo.findOne({ where: { uuid: hallazgoUuid } });
    if (!h) throw ApiError.notFound('Hallazgo no encontrado');
    await h.destroy();
  },

  // Convierte el hallazgo en una programación de mantenimiento (corrección o seguimiento) para el equipo de la orden.
  async programarCorreccion(hallazgoUuid, { fecha, prioridad }, user) {
    const h = await OrdenHallazgo.findOne({ where: { uuid: hallazgoUuid } });
    if (!h) throw ApiError.notFound('Hallazgo no encontrado');
    if (h.programacionId) throw ApiError.conflict('Este hallazgo ya tiene una programación');
    const orden = await OrdenMantenimiento.findByPk(h.ordenId);
    const detalle = [h.descripcion, h.pendienteRepuesto ? `Repuesto pendiente: ${h.pendienteRepuesto}` : null, h.recomendacion ? `Recomendación: ${h.recomendacion}` : null].filter(Boolean).join(' · ');
    const p = await ProgramacionMantenimiento.create({
      planId: null,
      equipoId: orden.equipoId,
      fechaProgramada: fecha || new Date().toISOString().slice(0, 10),
      estado: 'PROGRAMADA',
      prioridad: PRIORIDADES.includes(prioridad) ? prioridad : h.prioridad,
      observaciones: `Hallazgo de la orden ${orden.numero}: ${detalle}`.slice(0, 1000),
      createdBy: user?.id ?? null,
    });
    await h.update({ programacionId: p.id, estado: 'EN_SEGUIMIENTO', updatedBy: user?.id ?? null });
    return hallazgoPublico(await OrdenHallazgo.findByPk(h.id, { include: incluirHallazgo }));
  },

  // Hallazgos de un equipo (de todas sus órdenes); por defecto los que siguen sin resolver.
  async hallazgosDeEquipo(equipoUuid, { estado } = {}) {
    const equipo = await Equipo.findOne({ where: { uuid: equipoUuid }, attributes: ['id'] });
    if (!equipo) throw ApiError.notFound('Equipo no encontrado');
    const ordenes = await OrdenMantenimiento.findAll({ where: { equipoId: equipo.id }, attributes: ['id', 'uuid', 'numero', 'fecha'], raw: true });
    if (ordenes.length === 0) return [];
    const filas = await OrdenHallazgo.findAll({
      where: { ordenId: { [Op.in]: ordenes.map((o) => o.id) }, ...(estado ? { estado } : { estado: { [Op.ne]: 'RESUELTO' } }) },
      include: incluirHallazgo,
      order: [['id', 'DESC']],
    });
    const porId = new Map(ordenes.map((o) => [o.id, o]));
    return filas.map((h) => ({ ...hallazgoPublico(h), orden: { uuid: porId.get(h.ordenId).uuid, numero: porId.get(h.ordenId).numero, fecha: porId.get(h.ordenId).fecha } }));
  },
};

export default ordenChecklistService;
