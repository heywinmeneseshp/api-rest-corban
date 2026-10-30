import { Op } from 'sequelize';
import { AspersionProgramacion, Finca, Pista } from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';

// Pistas de aviación (Sanidad Vegetal → Pistas): de dónde sale la aspersión aérea y a qué correos llega su aviso.

const leerCorreos = (v) => {
  if (!v) return [];
  try {
    const arr = typeof v === 'string' ? JSON.parse(v) : v;
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
};

// Correos sin repetir, en minúscula y sin espacios.
const limpiarCorreos = (lista = []) => [...new Set(lista.map((c) => String(c || '').trim().toLowerCase()).filter(Boolean))];

export const mapPista = (p) => ({
  uuid: p.uuid,
  nombre: p.nombre,
  correos: leerCorreos(p.correos),
  observaciones: p.observaciones ?? null,
  estado: p.estado,
});

export const correosDePista = (p) => (p ? leerCorreos(p.correos) : []);

async function validarNombre(nombre, exceptoId = null) {
  const otra = await Pista.findOne({ where: { nombre: String(nombre).trim() }, attributes: ['id'] });
  if (otra && otra.id !== exceptoId) throw ApiError.conflict('Ya existe una pista con ese nombre');
}

export const pistaService = {
  async listar(query = {}) {
    const pistas = await Pista.findAll({ where: query.activas ? { estado: true } : {}, order: [['estado', 'DESC'], ['nombre', 'ASC']] });
    return pistas.map(mapPista);
  },

  // Pista predeterminada para una finca: la de su última aspersión con pista (la más reciente por fecha).
  async ultimaDeFinca(fincaUuid) {
    const finca = await Finca.findOne({ where: { uuid: fincaUuid }, attributes: ['id'] });
    if (!finca) throw ApiError.badRequest('Finca no encontrada');
    const ultima = await AspersionProgramacion.findOne({
      where: { fincaId: finca.id, pistaId: { [Op.ne]: null } },
      attributes: ['pistaId'],
      include: [{ model: Pista, as: 'pista', where: { estado: true }, required: true }],
      order: [['fecha', 'DESC'], ['id', 'DESC']],
    });
    return ultima?.pista ? mapPista(ultima.pista) : null;
  },

  async crear(datos, actorId) {
    await validarNombre(datos.nombre);
    const p = await Pista.create({
      nombre: String(datos.nombre).trim(),
      correos: limpiarCorreos(datos.correos),
      observaciones: datos.observaciones || null,
      estado: datos.estado ?? true,
      createdBy: actorId,
    });
    return mapPista(p);
  },

  async actualizar(uuid, datos, actorId) {
    const p = await Pista.findOne({ where: { uuid } });
    if (!p) throw ApiError.notFound('Pista no encontrada');
    const data = { updatedBy: actorId };
    if (datos.nombre !== undefined) {
      await validarNombre(datos.nombre, p.id);
      data.nombre = String(datos.nombre).trim();
    }
    if (datos.correos !== undefined) data.correos = limpiarCorreos(datos.correos);
    if (datos.observaciones !== undefined) data.observaciones = datos.observaciones || null;
    if (datos.estado !== undefined) data.estado = datos.estado;
    await p.update(data);
    return mapPista(p);
  },

  // Borrado suave: las aspersiones que ya la usaron siguen mostrando su nombre.
  async eliminar(uuid, actorId) {
    const p = await Pista.findOne({ where: { uuid } });
    if (!p) throw ApiError.notFound('Pista no encontrada');
    await p.update({ deletedBy: actorId });
    await p.destroy();
  },
};

export default pistaService;
