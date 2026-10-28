import { colaboradorRepository } from '../../repositories/agricola/colaborador.repository.js';
import { laborRepository } from '../../repositories/agricola/labor.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { Op, fn, col } from 'sequelize';
import { Finca, ColaboradorRostro, User, Colaborador } from '../../database/associations.js';
import { sequelize } from '../../database/connection.js';
import { userService } from '../seguridad/user.service.js';
import { assertFincaPermitida, getFincaIdsPermitidas } from '../../utils/fincaScope.js';

// Alcance por fincas asignadas: el usuario restringido ve los colaboradores de sus fincas y su propia ficha; quien no tiene
// restricción (Administrador o sin fincas asignadas) ve todos. Devuelve null si no hay restricción.
export const alcanceColaboradores = (user) => {
  const fincaIds = getFincaIdsPermitidas(user);
  if (!fincaIds) return null;
  return { [Op.or]: [{ fincaId: { [Op.in]: fincaIds } }, ...(user?.id ? [{ userId: user.id }] : [])] };
};
export const enAlcance = (colaborador, user) => {
  const fincaIds = getFincaIdsPermitidas(user);
  return !fincaIds || (colaborador.fincaId && fincaIds.includes(colaborador.fincaId)) || (user?.id && colaborador.userId === user.id);
};

// Documento de identificación normalizado (sin espacios, puntos ni guiones) para no permitir dos colaboradores con la misma.
export const normalizarDocumento = (d) => (d ? String(d).replace(/[\s.-]/g, '').toUpperCase() : '');

async function validarDocumentoUnico(documento, exceptoId = null) {
  const doc = normalizarDocumento(documento);
  if (!doc) return;
  const [otro] = await sequelize.query(
    `SELECT id, nombre, apellido FROM colaboradores
      WHERE deleted_at IS NULL AND UPPER(REPLACE(REPLACE(REPLACE(documento, ' ', ''), '.', ''), '-', '')) = :doc
        AND (:excepto IS NULL OR id <> :excepto)
      LIMIT 1`,
    { replacements: { doc, excepto: exceptoId }, type: sequelize.QueryTypes.SELECT },
  );
  if (otro) throw ApiError.conflict(`Ya existe un colaborador con la identificación ${documento} (${`${otro.nombre} ${otro.apellido || ''}`.trim()})`);
}

// Nombres y apellidos con la primera letra de cada palabra en mayúscula y el resto en minúscula ("maría JOSÉ" → "María José").
const capitalizarPalabras = (texto) =>
  texto
    ? texto
        .trim()
        .split(/\s+/)
        .map((p) => p.charAt(0).toLocaleUpperCase('es-CO') + p.slice(1).toLocaleLowerCase('es-CO'))
        .join(' ')
    : texto;

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
  async listColaboradores(query, user) {
    const { page, limit, offset } = getPagination(query);
    const fincaId = query.fincaUuid ? (await findFincaOrFail(query.fincaUuid)).id : undefined;
    const estado = query.estado !== undefined ? query.estado === 'true' || query.estado === true : undefined;

    const { rows, count } = await colaboradorRepository.findAndCountAll({
      limit,
      offset,
      search: query.search,
      fincaId,
      estado,
      alcance: alcanceColaboradores(user),
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

  // `user`: si se pasa, el colaborador debe estar en su alcance (si no, 404 como si no existiera).
  async getColaboradorByUuid(uuid, user = null) {
    const colaborador = await colaboradorRepository.findByUuid(uuid);
    if (!colaborador || (user && !enAlcance(colaborador, user))) throw ApiError.notFound('Colaborador no encontrado');
    return colaborador;
  },

  async createColaborador(payload, actorId, actor = null) {
    const fincaId = payload.fincaUuid ? (await findFincaOrFail(payload.fincaUuid)).id : null;
    // Con fincas asignadas solo se crean colaboradores en esas fincas (la finca es obligatoria).
    if (actor && getFincaIdsPermitidas(actor)) {
      if (!fincaId) throw ApiError.badRequest('Elige la finca del colaborador (una de tus fincas asignadas)');
      assertFincaPermitida(actor, fincaId);
    }
    await validarDocumentoUnico(payload.documento);
    const labores = await resolverLabores(payload.labores);
    // Colaborador creado desde un usuario existente: queda vinculado a él.
    const user = payload.userUuid ? await userLibreOrFail(payload.userUuid) : null;

    return sequelize.transaction(async (transaction) => {
      const colaborador = await colaboradorRepository.create(
        {
          nombre: capitalizarPalabras(payload.nombre),
          apellido: capitalizarPalabras(payload.apellido) || null,
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

  async updateColaborador(uuid, payload, actorId, user = null) {
    const colaborador = await this.getColaboradorByUuid(uuid, user);
    if (payload.documento !== undefined) await validarDocumentoUnico(payload.documento, colaborador.id);

    const data = { updatedBy: actorId };
    if (payload.nombre !== undefined) data.nombre = capitalizarPalabras(payload.nombre);
    if (payload.apellido !== undefined) data.apellido = capitalizarPalabras(payload.apellido) || null;
    if (payload.documento !== undefined) data.documento = payload.documento || null;
    if (payload.telefono !== undefined) data.telefono = payload.telefono || null;
    if (payload.email !== undefined) data.email = payload.email || null;
    if (payload.cargo !== undefined) data.cargo = payload.cargo || null;
    if (payload.estado !== undefined) data.estado = payload.estado;
    if (payload.fincaUuid !== undefined) {
      data.fincaId = payload.fincaUuid ? (await findFincaOrFail(payload.fincaUuid)).id : null;
      // No se puede mover a una finca fuera de las asignadas (ni dejarlo sin finca si el usuario está restringido).
      if (user && getFincaIdsPermitidas(user)) {
        if (!data.fincaId) throw ApiError.badRequest('El colaborador debe quedar en una de tus fincas asignadas');
        assertFincaPermitida(user, data.fincaId);
      }
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
  async vincularUsuario(uuid, userUuid, actorId, actor = null) {
    const colaborador = await this.getColaboradorByUuid(uuid, actor);
    const user = await userLibreOrFail(userUuid, colaborador.id);
    await colaboradorRepository.update(colaborador, { userId: user.id, updatedBy: actorId });
    return colaboradorRepository.findByUuid(uuid);
  },

  async desvincularUsuario(uuid, actorId, actor = null) {
    const colaborador = await this.getColaboradorByUuid(uuid, actor);
    await colaboradorRepository.update(colaborador, { userId: null, updatedBy: actorId });
    return colaboradorRepository.findByUuid(uuid);
  },

  // Crea un usuario del sistema a partir del colaborador y los deja vinculados.
  async crearUsuario(uuid, payload, actorId, actor = null) {
    const colaborador = await this.getColaboradorByUuid(uuid, actor);
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

  async deleteColaborador(uuid, actorId, user = null) {
    const colaborador = await this.getColaboradorByUuid(uuid, user);
    await colaboradorRepository.softDelete(colaborador, actorId);
  },

  // ─── Autoservicio: la ficha propia (colaborador vinculado al usuario de la sesión) ───
  async miFicha(user) {
    const c = await Colaborador.findOne({ where: { userId: user.id }, include: [{ model: Finca, as: 'finca', attributes: ['uuid', 'nombre'] }] });
    if (!c) return null;
    const muestras = await ColaboradorRostro.count({ where: { colaboradorId: c.id } });
    const { asistenciaService } = await import('./asistencia.service.js');
    return {
      uuid: c.uuid,
      nombre: c.nombre,
      apellido: c.apellido,
      documento: c.documento,
      cargo: c.cargo,
      finca: c.finca ? { uuid: c.finca.uuid, nombre: c.finca.nombre } : null,
      rostroMuestras: muestras,
      rostroEnrolado: muestras > 0,
      rostroConsentimiento: Boolean(c.rostroConsentimientoAt),
      solicitudRostro: await asistenciaService.ultimaSolicitudRostro(c.id),
    };
  },

  async crearMiFicha(payload, user) {
    if (await Colaborador.findOne({ where: { userId: user.id }, attributes: ['id'] })) throw ApiError.conflict('Ya tienes una ficha de colaborador');
    const fincaId = payload.fincaUuid ? (await findFincaOrFail(payload.fincaUuid)).id : null;
    if (fincaId) assertFincaPermitida(user, fincaId);
    await validarDocumentoUnico(payload.documento);
    const yo = await User.findByPk(user.id, { attributes: ['id', 'nombre', 'apellido', 'email', 'cargo'] });
    await colaboradorRepository.create({
      nombre: capitalizarPalabras(payload.nombre || yo.nombre),
      apellido: capitalizarPalabras(payload.apellido || yo.apellido) || null,
      documento: payload.documento || null,
      telefono: payload.telefono || null,
      email: yo.email || null,
      cargo: payload.cargo || yo.cargo || null,
      fincaId,
      estado: true,
      userId: user.id,
      createdBy: user.id,
    });
    return this.miFicha(user);
  },
};

export default colaboradorService;
