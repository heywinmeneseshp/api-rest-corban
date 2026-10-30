import { Op, fn, col } from 'sequelize';
import { Cargo, User, Colaborador } from '../../database/associations.js';
import { sequelize } from '../../database/connection.js';
import { ApiError } from '../../utils/ApiError.js';

// Maestros → Cargos: etiquetas de cargo para usuarios y colaboradores (uno por persona). Los formularios y las apps siguen
// enviando el NOMBRE del cargo (`cargo`); `resolverCargo` lo busca en el maestro y devuelve su id y su nombre oficial.

// Comparación sin mayúsculas, tildes ni espacios repetidos.
export const claveCargo = (t) =>
  String(t || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const mapCargo = (c, usos = {}) => ({
  uuid: c.uuid,
  nombre: c.nombre,
  descripcion: c.descripcion ?? null,
  estado: c.estado,
  usuarios: usos.usuarios ?? 0,
  colaboradores: usos.colaboradores ?? 0,
});

async function buscarPorNombre(nombre, { transaction } = {}) {
  const k = claveCargo(nombre);
  if (!k) return null;
  const todos = await Cargo.findAll({ attributes: ['id', 'nombre', 'estado'], transaction });
  return todos.find((c) => claveCargo(c.nombre) === k) || null;
}

// `cargo` (texto) → { cargo, cargoId } para guardar en el usuario o colaborador. Vacío → sin cargo. Si no existe en el maestro
// (o está inactivo) se rechaza: el cargo se elige de la lista. `crearSiNoExiste`: en el primer registro de un colaborador (crearlo
// o crear la ficha propia) se puede escribir un cargo nuevo y queda creado en el maestro.
export async function resolverCargo(texto, { transaction, crearSiNoExiste = false, actorId = null } = {}) {
  if (texto === null || texto === undefined || !String(texto).trim()) return { cargo: null, cargoId: null };
  const c = await buscarPorNombre(texto, { transaction });
  if (!c && crearSiNoExiste) {
    const nombre = String(texto).replace(/\s+/g, ' ').trim().slice(0, 150);
    const nuevo = await Cargo.create({ nombre, estado: true, createdBy: actorId }, { transaction });
    return { cargo: nuevo.nombre, cargoId: nuevo.id };
  }
  if (!c) throw ApiError.badRequest(`El cargo «${String(texto).trim()}» no existe: elígelo de la lista (Maestros → Cargos)`);
  if (!c.estado) throw ApiError.badRequest(`El cargo «${c.nombre}» está inactivo`);
  return { cargo: c.nombre, cargoId: c.id };
}

async function usosPorCargo(ids) {
  if (!ids.length) return new Map();
  const contar = async (Modelo) =>
    Modelo.findAll({ attributes: ['cargoId', [fn('COUNT', col('id')), 'n']], where: { cargoId: { [Op.in]: ids } }, group: ['cargoId'], raw: true });
  const [u, c] = await Promise.all([contar(User), contar(Colaborador)]);
  const m = new Map(ids.map((id) => [id, { usuarios: 0, colaboradores: 0 }]));
  for (const r of u) m.get(r.cargoId).usuarios = Number(r.n);
  for (const r of c) m.get(r.cargoId).colaboradores = Number(r.n);
  return m;
}

async function validarNombre(nombre, exceptoId = null) {
  const otro = await buscarPorNombre(nombre);
  if (otro && otro.id !== exceptoId) throw ApiError.conflict(`Ya existe el cargo «${otro.nombre}»`);
}

async function findOrFail(uuid) {
  const c = await Cargo.findOne({ where: { uuid } });
  if (!c) throw ApiError.notFound('Cargo no encontrado');
  return c;
}

export const cargoService = {
  async listar(query = {}) {
    const cargos = await Cargo.findAll({ where: query.activos ? { estado: true } : {}, order: [['nombre', 'ASC']] });
    const usos = await usosPorCargo(cargos.map((c) => c.id));
    return cargos.map((c) => mapCargo(c, usos.get(c.id)));
  },

  async crear(datos, actorId) {
    const nombre = String(datos.nombre).replace(/\s+/g, ' ').trim();
    await validarNombre(nombre);
    const c = await Cargo.create({ nombre, descripcion: datos.descripcion || null, estado: datos.estado ?? true, createdBy: actorId });
    return mapCargo(c);
  },

  // Renombrar actualiza la copia del nombre en todos los usuarios y colaboradores que lo tienen (y así en sus firmas).
  async actualizar(uuid, datos, actorId) {
    const c = await findOrFail(uuid);
    const data = { updatedBy: actorId };
    if (datos.nombre !== undefined) {
      data.nombre = String(datos.nombre).replace(/\s+/g, ' ').trim();
      await validarNombre(data.nombre, c.id);
    }
    if (datos.descripcion !== undefined) data.descripcion = datos.descripcion || null;
    if (datos.estado !== undefined) data.estado = datos.estado;
    await sequelize.transaction(async (transaction) => {
      await c.update(data, { transaction });
      if (data.nombre !== undefined) {
        await User.update({ cargo: data.nombre }, { where: { cargoId: c.id }, transaction });
        await Colaborador.update({ cargo: data.nombre }, { where: { cargoId: c.id }, transaction });
      }
    });
    const usos = await usosPorCargo([c.id]);
    return mapCargo(c, usos.get(c.id));
  },

  // Si nadie lo tiene, se elimina. Si está asignado, solo con `reemplazoUuid`: sus personas pasan a ese cargo y luego se elimina
  // (sirve para fusionar cargos repetidos o mal escritos).
  async eliminar(uuid, actorId, { reemplazoUuid = null } = {}) {
    const c = await findOrFail(uuid);
    const usos = (await usosPorCargo([c.id])).get(c.id);
    const enUso = usos.usuarios || usos.colaboradores;
    if (enUso && !reemplazoUuid) {
      throw ApiError.conflict(
        `«${c.nombre}» está asignado a ${usos.usuarios} usuario(s) y ${usos.colaboradores} colaborador(es): elige a qué cargo pasan o inactívalo`,
      );
    }
    const destino = reemplazoUuid ? await findOrFail(reemplazoUuid) : null;
    if (destino && destino.id === c.id) throw ApiError.badRequest('Elige un cargo distinto');
    await sequelize.transaction(async (transaction) => {
      if (destino) {
        await User.update({ cargoId: destino.id, cargo: destino.nombre }, { where: { cargoId: c.id }, transaction });
        await Colaborador.update({ cargoId: destino.id, cargo: destino.nombre }, { where: { cargoId: c.id }, transaction });
      }
      await c.update({ deletedBy: actorId }, { transaction });
      await c.destroy({ transaction });
    });
  },
};
