import { sequelize } from '../../database/connection.js';
import { ChecklistPlantilla, ChecklistPlantillaItem, PlanMantenimiento } from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';

// Plantillas de checklist de mantenimiento: secciones e ítems reutilizables. Un plan elige una plantilla y cada orden de ese plan copia sus ítems.
// `secciones`: [{ seccion, items: [texto, ...] }] — el orden del arreglo es el orden en pantalla.

const aSecciones = (items) => {
  const mapa = new Map();
  for (const it of [...items].sort((a, b) => a.seccionOrden - b.seccionOrden || a.orden - b.orden)) {
    if (!mapa.has(it.seccion)) mapa.set(it.seccion, []);
    mapa.get(it.seccion).push(it.descripcion);
  }
  return [...mapa.entries()].map(([seccion, lista]) => ({ seccion, items: lista }));
};

const normalizarSecciones = (secciones) => {
  const limpias = (secciones || [])
    .map((s) => ({ seccion: String(s.seccion || '').trim(), items: (s.items || []).map((i) => String(i || '').trim()).filter(Boolean) }))
    .filter((s) => s.seccion && s.items.length);
  if (limpias.length === 0) throw ApiError.badRequest('El checklist necesita al menos una sección con un ítem');
  return limpias;
};

const filasItems = (plantillaId, secciones) => {
  const filas = [];
  secciones.forEach((s, si) => s.items.forEach((descripcion, ii) => filas.push({ plantillaId, seccion: s.seccion, seccionOrden: si + 1, orden: ii + 1, descripcion })));
  return filas;
};

const publica = (p, items, planes = null) => ({
  uuid: p.uuid,
  nombre: p.nombre,
  descripcion: p.descripcion,
  estado: p.estado,
  secciones: aSecciones(items),
  totalItems: items.length,
  ...(planes !== null ? { planes } : {}),
});

async function buscar(uuid) {
  const p = await ChecklistPlantilla.findOne({ where: { uuid } });
  if (!p) throw ApiError.notFound('Plantilla de checklist no encontrada');
  return p;
}

export const checklistPlantillaService = {
  async list() {
    const filas = await ChecklistPlantilla.findAll({ order: [['nombre', 'ASC']] });
    const items = await ChecklistPlantillaItem.findAll({ where: { plantillaId: filas.map((f) => f.id) }, raw: true });
    const planes = await PlanMantenimiento.findAll({ attributes: ['plantillaId'], where: { plantillaId: filas.map((f) => f.id) }, raw: true });
    return filas.map((p) => publica(p, items.filter((i) => i.plantillaId === p.id), planes.filter((x) => x.plantillaId === p.id).length));
  },

  async getByUuid(uuid) {
    const p = await buscar(uuid);
    return publica(p, await ChecklistPlantillaItem.findAll({ where: { plantillaId: p.id }, raw: true }));
  },

  async create({ nombre, descripcion, estado = true, secciones }, actorId) {
    const limpias = normalizarSecciones(secciones);
    const uuid = await sequelize.transaction(async (transaction) => {
      const p = await ChecklistPlantilla.create({ nombre: nombre.trim(), descripcion: descripcion || null, estado, createdBy: actorId, updatedBy: actorId }, { transaction });
      await ChecklistPlantillaItem.bulkCreate(filasItems(p.id, limpias), { transaction });
      return p.uuid;
    });
    return this.getByUuid(uuid);
  },

  // Reemplaza los ítems de la plantilla. Las órdenes ya creadas conservan su copia: cambiar la plantilla no las toca.
  async update(uuid, { nombre, descripcion, estado, secciones }, actorId) {
    const p = await buscar(uuid);
    await sequelize.transaction(async (transaction) => {
      await p.update(
        { ...(nombre !== undefined ? { nombre: nombre.trim() } : {}), ...(descripcion !== undefined ? { descripcion: descripcion || null } : {}), ...(estado !== undefined ? { estado } : {}), updatedBy: actorId },
        { transaction },
      );
      if (secciones !== undefined) {
        const limpias = normalizarSecciones(secciones);
        await ChecklistPlantillaItem.destroy({ where: { plantillaId: p.id }, transaction });
        await ChecklistPlantillaItem.bulkCreate(filasItems(p.id, limpias), { transaction });
      }
    });
    return this.getByUuid(uuid);
  },

  // Baja lógica; los planes que la usaban quedan sin plantilla.
  async delete(uuid) {
    const p = await buscar(uuid);
    await sequelize.transaction(async (transaction) => {
      await PlanMantenimiento.update({ plantillaId: null }, { where: { plantillaId: p.id }, transaction });
      await p.destroy({ transaction });
    });
  },
};

export default checklistPlantillaService;
