import { colaboradorRepository } from '../../repositories/agricola/colaborador.repository.js';
import { laborRepository } from '../../repositories/agricola/labor.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { Op, fn, col } from 'sequelize';
import { Finca, ColaboradorRostro, User, Colaborador } from '../../database/associations.js';
import { sequelize } from '../../database/connection.js';
import { userService } from '../seguridad/user.service.js';

const CALIFICACION_MIN = 1;
const CALIFICACION_MAX = 5;

// Un usuario solo puede estar vinculado a un colaborador.
const userLibreOrFail = async (userUuid, colaboradorId = null) => {
  const user = await User.findOne({ where: { uuid: userUuid } });
  if (!user) throw ApiError.notFound('Usuario no encontrado');
  const otro = await Colaborador.findOne({ where: { userId: user.id } });
  if (otro && otro.id !== colaboradorId) throw ApiError.conflict('Ese usuario ya está vinculado a otro colaborador');
  return user;
};

const findFincaOrFail = async (uuid) => {
  const finca = await Finca.findOne({ where: { uuid } });
  if (!finca) throw ApiError.notFound('Finca no encontrada');
  return finca;
};

// Resuelve cada { laborUuid, calificacion } a { laborId, calificacion },
// validando que la labor exista y que la calificación esté en rango — se
// hace una vez acá para no repetir la validación en create/update.
const resolverLabores = async (labores = []) => {
  const resueltas = [];
  for (const item of labores) {
    if (item.calificacion < CALIFICACION_MIN || item.calificacion > CALIFICACION_MAX) {
      throw ApiError.badRequest(`La calificación debe estar entre ${CALIFICACION_MIN} y ${CALIFICACION_MAX}`);
    }
    const labor = await laborRepository.findByUuid(item.laborUuid);
    if (!labor) throw ApiError.notFound(`Labor no encontrada: ${item.laborUuid}`);
    resueltas.push({ laborId: labor.id, calificacion: item.calificacion });
  }
  const laborIds = resueltas.map((r) => r.laborId);
  if (new Set(laborIds).size !== laborIds.length) {
    throw ApiError.badRequest('No se puede calificar la misma labor más de una vez');
  }
  return resueltas;
};

export const colaboradorService = {
  async listColaboradores(query) {
    const { page, limit, offset } = getPagination(query);
    const fincaId = query.fincaUuid ? (await findFincaOrFail(query.fincaUuid)).id : undefined;
    const estado = query.estado !== undefined ? query.estado === 'true' || query.estado === true : undefined;

    const { rows, count } = await colaboradorRepository.findAndCountAll({
      limit,
      offset,
      search: query.search,
      fincaId,
      estado,
    });
    // Cuántas muestras faciales tiene cada uno (la pantalla muestra "Rostro: enrolado / sin enrolar").
    const conteos = rows.length
      ? await ColaboradorRostro.findAll({
          attributes: ['colaboradorId', [fn('COUNT', col('id')), 'n']],
          where: { colaboradorId: { [Op.in]: rows.map((r) => r.id) } },
          group: ['colaboradorId'],
          raw: true,
        })
      : [];
    const muestras = new Map(conteos.map((c) => [c.colaboradorId, Number(c.n)]));
    const items = rows.map((r) => ({ ...r.toJSON(), rostroMuestras: muestras.get(r.id) || 0, rostroEnrolado: (muestras.get(r.id) || 0) > 0 }));
    return { items, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getColaboradorByUuid(uuid) {
    const colaborador = await colaboradorRepository.findByUuid(uuid);
    if (!colaborador) throw ApiError.notFound('Colaborador no encontrado');
    return colaborador;
  },

  async createColaborador(payload, actorId) {
    const fincaId = payload.fincaUuid ? (await findFincaOrFail(payload.fincaUuid)).id : null;
    const labores = await resolverLabores(payload.labores);
    // Colaborador creado desde un usuario existente: queda vinculado a él.
    const user = payload.userUuid ? await userLibreOrFail(payload.userUuid) : null;

    return sequelize.transaction(async (transaction) => {
      const colaborador = await colaboradorRepository.create(
        {
          nombre: payload.nombre,
          apellido: payload.apellido || null,
          documento: payload.documento || null,
          telefono: payload.telefono || null,
          email: payload.email || null,
          cargo: payload.cargo || null,
          fincaId,
          estado: payload.estado ?? true,
          userId: user?.id ?? null,
          createdBy: actorId,
        },
        { transaction },
      );

      if (labores.length) {
        await colaboradorRepository.replaceLabores(colaborador.id, labores, actorId, { transaction });
      }

      return colaboradorRepository.findByUuid(colaborador.uuid, { transaction });
    });
  },

  async updateColaborador(uuid, payload, actorId) {
    const colaborador = await this.getColaboradorByUuid(uuid);

    const data = { updatedBy: actorId };
    if (payload.nombre !== undefined) data.nombre = payload.nombre;
    if (payload.apellido !== undefined) data.apellido = payload.apellido || null;
    if (payload.documento !== undefined) data.documento = payload.documento || null;
    if (payload.telefono !== undefined) data.telefono = payload.telefono || null;
    if (payload.email !== undefined) data.email = payload.email || null;
    if (payload.cargo !== undefined) data.cargo = payload.cargo || null;
    if (payload.estado !== undefined) data.estado = payload.estado;
    if (payload.fincaUuid !== undefined) {
      data.fincaId = payload.fincaUuid ? (await findFincaOrFail(payload.fincaUuid)).id : null;
    }

    const labores = payload.labores !== undefined ? await resolverLabores(payload.labores) : undefined;

    return sequelize.transaction(async (transaction) => {
      await colaboradorRepository.update(colaborador, data, { transaction });
      if (labores !== undefined) {
        await colaboradorRepository.replaceLabores(colaborador.id, labores, actorId, { transaction });
      }
      return colaboradorRepository.findByUuid(uuid, { transaction });
    });
  },

  // Vincula un colaborador existente con un usuario existente.
  async vincularUsuario(uuid, userUuid, actorId) {
    const colaborador = await this.getColaboradorByUuid(uuid);
    const user = await userLibreOrFail(userUuid, colaborador.id);
    await colaboradorRepository.update(colaborador, { userId: user.id, updatedBy: actorId });
    return colaboradorRepository.findByUuid(uuid);
  },

  async desvincularUsuario(uuid, actorId) {
    const colaborador = await this.getColaboradorByUuid(uuid);
    await colaboradorRepository.update(colaborador, { userId: null, updatedBy: actorId });
    return colaboradorRepository.findByUuid(uuid);
  },

  // Crea un usuario del sistema a partir del colaborador y los deja vinculados.
  async crearUsuario(uuid, payload, actorId) {
    const colaborador = await this.getColaboradorByUuid(uuid);
    if (colaborador.userId) throw ApiError.conflict('El colaborador ya tiene un usuario');
    const email = payload.email || colaborador.email;
    if (!email) throw ApiError.badRequest('El colaborador no tiene correo: indica uno para crear el usuario');
    if (!colaborador.apellido) throw ApiError.badRequest('El colaborador no tiene apellido: edítalo antes de crear su usuario');
    const user = await userService.createUser(
      {
        usuario: payload.usuario,
        nombre: colaborador.nombre,
        apellido: colaborador.apellido,
        email,
        password: payload.password,
        cargo: colaborador.cargo,
        estado: colaborador.estado,
      },
      actorId,
    );
    const creado = await User.findOne({ where: { usuario: user.usuario }, attributes: ['id'] });
    await colaboradorRepository.update(colaborador, { userId: creado.id, updatedBy: actorId });
    return colaboradorRepository.findByUuid(uuid);
  },

  async deleteColaborador(uuid, actorId) {
    const colaborador = await this.getColaboradorByUuid(uuid);
    await colaboradorRepository.softDelete(colaborador, actorId);
  },
};

export default colaboradorService;
