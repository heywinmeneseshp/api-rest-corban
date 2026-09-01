import { sequelize } from '../../database/connection.js';
import { equipoRepository } from '../../repositories/inventario/equipo.repository.js';
import { Almacen, Articulo, User } from '../../database/associations.js';
import { EquipoComponente } from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';

// `almacenes.tipo` distingue ALMACEN de CENTRO_COSTO en la misma tabla (ver
// associations.js) pero no hay ninguna restricción a nivel de FK que impida
// poner un almacén físico en `centroCostoId` o un centro de costo en
// `ubicacionId` — se valida acá, a nivel de aplicación.
async function resolveAlmacen(uuid, fieldName, tipoEsperado) {
  if (!uuid) return null;
  const alm = await Almacen.findOne({ where: { uuid } });
  if (!alm) throw ApiError.notFound(`${fieldName} no encontrado`);
  if (tipoEsperado && alm.tipo !== tipoEsperado) {
    throw ApiError.badRequest(`${fieldName} debe ser un registro de tipo ${tipoEsperado} (este es ${alm.tipo})`);
  }
  return alm;
}

async function resolveArticulo(uuid) {
  const p = await Articulo.findOne({ where: { uuid } });
  if (!p) throw ApiError.notFound('Artículo (repuesto) no encontrado');
  return p;
}

async function resolveUser(uuid) {
  if (!uuid) return null;
  const u = await User.findOne({ where: { uuid } });
  if (!u) throw ApiError.notFound('Usuario responsable no encontrado');
  return u;
}

export const equipoService = {
  async list(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await equipoRepository.findAndCountAll({
      limit,
      offset,
      search: query.search,
      tipo: query.tipo,
      estado: query.estado,
      ubicacionUuid: query.ubicacionUuid,
      centroCostoUuid: query.centroCostoUuid,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getByUuid(uuid) {
    const equipo = await equipoRepository.findByUuid(uuid);
    if (!equipo) throw ApiError.notFound('Equipo no encontrado');
    return equipo;
  },

  async create(payload, actorId) {
    const existing = await equipoRepository.findByCodigo(payload.codigo);
    if (existing) throw ApiError.conflict('Ya existe un equipo con ese código');

    const ubicacion = await resolveAlmacen(payload.ubicacionUuid, 'Ubicación (almacén)', 'ALMACEN');
    const centroCosto = await resolveAlmacen(payload.centroCostoUuid, 'Centro de costo', 'CENTRO_COSTO');
    const responsable = await resolveUser(payload.responsableUuid);

    return sequelize.transaction(async (t) => {
      const equipo = await equipoRepository.create(
        {
          codigo: payload.codigo,
          nombre: payload.nombre,
          descripcion: payload.descripcion || null,
          tipo: payload.tipo || 'OTRO',
          marca: payload.marca || null,
          modelo: payload.modelo || null,
          serie: payload.serie || null,
          fechaAdquisicion: payload.fechaAdquisicion || null,
          ubicacionId: ubicacion ? ubicacion.id : null,
          centroCostoId: centroCosto ? centroCosto.id : null,
          estado: payload.estado || 'OPERATIVO',
          horometro: payload.horometro ?? 0,
          kilometraje: payload.kilometraje ?? 0,
          responsableId: responsable ? responsable.id : null,
          observaciones: payload.observaciones || null,
          createdBy: actorId,
        },
        { transaction: t },
      );

      if (payload.repuestosUuids && Array.isArray(payload.repuestosUuids) && payload.repuestosUuids.length) {
        for (const uuid of payload.repuestosUuids) {
          const articulo = await resolveArticulo(uuid);
          await EquipoComponente.create({ equipoId: equipo.id, articuloId: articulo.id }, { transaction: t });
        }
      }

      return equipoRepository.findByUuid(equipo.uuid);
    });
  },

  async update(uuid, payload, actorId) {
    const equipo = await this.getByUuid(uuid);

    if (payload.codigo && payload.codigo !== equipo.codigo) {
      const existing = await equipoRepository.findByCodigo(payload.codigo);
      if (existing && existing.id !== equipo.id) throw ApiError.conflict('Ya existe un equipo con ese código');
    }

    let ubicacionId = equipo.ubicacionId;
    if (payload.ubicacionUuid !== undefined) {
      if (!payload.ubicacionUuid) ubicacionId = null;
      else {
        const alm = await resolveAlmacen(payload.ubicacionUuid, 'Ubicación', 'ALMACEN');
        ubicacionId = alm.id;
      }
    }

    let centroCostoId = equipo.centroCostoId;
    if (payload.centroCostoUuid !== undefined) {
      if (!payload.centroCostoUuid) centroCostoId = null;
      else {
        const alm = await resolveAlmacen(payload.centroCostoUuid, 'Centro de costo', 'CENTRO_COSTO');
        centroCostoId = alm.id;
      }
    }

    let responsableId = equipo.responsableId;
    if (payload.responsableUuid !== undefined) {
      if (!payload.responsableUuid) responsableId = null;
      else {
        const u = await resolveUser(payload.responsableUuid);
        responsableId = u.id;
      }
    }

    const data = {
      ...(payload.codigo ? { codigo: payload.codigo } : {}),
      ...(payload.nombre ? { nombre: payload.nombre } : {}),
      ...(payload.descripcion !== undefined ? { descripcion: payload.descripcion || null } : {}),
      ...(payload.tipo ? { tipo: payload.tipo } : {}),
      ...(payload.marca !== undefined ? { marca: payload.marca || null } : {}),
      ...(payload.modelo !== undefined ? { modelo: payload.modelo || null } : {}),
      ...(payload.serie !== undefined ? { serie: payload.serie || null } : {}),
      ...(payload.fechaAdquisicion !== undefined ? { fechaAdquisicion: payload.fechaAdquisicion || null } : {}),
      ubicacionId,
      centroCostoId,
      ...(payload.estado ? { estado: payload.estado } : {}),
      ...(payload.horometro !== undefined ? { horometro: payload.horometro } : {}),
      ...(payload.kilometraje !== undefined ? { kilometraje: payload.kilometraje } : {}),
      responsableId,
      ...(payload.observaciones !== undefined ? { observaciones: payload.observaciones || null } : {}),
      updatedBy: actorId,
    };

    return sequelize.transaction(async (t) => {
      await equipoRepository.update(equipo, data, { transaction: t });

      if (payload.repuestosUuids !== undefined) {
        // Reemplaza todos los compatibles
        await EquipoComponente.destroy({ where: { equipoId: equipo.id }, transaction: t });
        if (Array.isArray(payload.repuestosUuids) && payload.repuestosUuids.length) {
          for (const uuid of payload.repuestosUuids) {
            const articulo = await resolveArticulo(uuid);
            await EquipoComponente.create({ equipoId: equipo.id, articuloId: articulo.id }, { transaction: t });
          }
        }
      }

      return equipoRepository.findByUuid(uuid);
    });
  },

  async delete(uuid, actorId) {
    const equipo = await this.getByUuid(uuid);
    await equipoRepository.softDelete(equipo, actorId);
  },

  async addComponente(uuid, articuloUuid, notas) {
    const equipo = await this.getByUuid(uuid);
    const articulo = await resolveArticulo(articuloUuid);
    try {
      await sequelize.transaction(async (t) => {
        // Lock de fila para que el chequeo de duplicado y el insert queden
        // atómicos — dos requests concurrentes agregando el mismo repuesto
        // ya no pueden pasar ambas el chequeo antes de que cualquiera cree
        // la fila (antes, sin transacción/lock, era un check-then-act real).
        const existing = await EquipoComponente.findOne({
          where: { equipoId: equipo.id, articuloId: articulo.id },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (existing) throw ApiError.conflict('El repuesto ya es compatible con este equipo');
        await EquipoComponente.create({ equipoId: equipo.id, articuloId: articulo.id, notas: notas || null }, { transaction: t });
      });
    } catch (err) {
      // Constraint único (uniq_equipo_articulo) como última defensa si dos
      // transacciones concurrentes igual llegan a chocar.
      if (err?.name === 'SequelizeUniqueConstraintError') throw ApiError.conflict('El repuesto ya es compatible con este equipo');
      throw err;
    }
    return this.getByUuid(uuid);
  },

  async removeComponente(uuid, articuloUuid) {
    const equipo = await this.getByUuid(uuid);
    const articulo = await resolveArticulo(articuloUuid);
    const deleted = await sequelize.transaction((t) =>
      EquipoComponente.destroy({ where: { equipoId: equipo.id, articuloId: articulo.id }, transaction: t }),
    );
    if (!deleted) throw ApiError.notFound('Relación equipo-repuesto no encontrada');
    return this.getByUuid(uuid);
  },
};

export default equipoService;
