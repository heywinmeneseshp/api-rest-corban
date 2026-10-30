import { colaboradorRepository } from '../../repositories/agricola/colaborador.repository.js';
import { laborRepository } from '../../repositories/agricola/labor.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { Op, fn, col } from 'sequelize';
import { Finca, ColaboradorRostro, User, Colaborador, AsistenciaLugar } from '../../database/associations.js';
import { sequelize } from '../../database/connection.js';
import { userService } from '../seguridad/user.service.js';
import { assertFincaPermitida, getFincaIdsPermitidas } from '../../utils/fincaScope.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { resolverCargo } from '../seguridad/cargo.service.js';
import { ROLES } from '../../constants/roles.constants.js';

// Módulos de colaboradores: los de Sanidad Vegetal se crean desde su propio módulo, con permisos propios.
export const MODULO_SANIDAD = 'SANIDAD_VEGETAL';
export const MODULOS_COLABORADOR = ['GENERAL', MODULO_SANIDAD];
const PERMISOS_GENERAL = { ver: PERMISSIONS.COLABORADOR_VER, crear: PERMISSIONS.COLABORADOR_CREAR, editar: PERMISSIONS.COLABORADOR_EDITAR, eliminar: PERMISSIONS.COLABORADOR_ELIMINAR };
const PERMISOS_SANIDAD = { ver: PERMISSIONS.SV_COLABORADOR_VER, crear: PERMISSIONS.SV_COLABORADOR_CREAR, editar: PERMISSIONS.SV_COLABORADOR_EDITAR, eliminar: PERMISSIONS.SV_COLABORADOR_ELIMINAR };
const tienePermiso = (user, codigo) => (user?.roles || []).includes(ROLES.ADMINISTRADOR) || (user?.permissions || []).includes(codigo);
export const puedeColaboradoresSanidad = (user, accion = 'ver') => tienePermiso(user, PERMISOS_SANIDAD[accion]);
// Quien tiene el permiso de Sanidad Vegetal para la acción pero no el general solo opera sobre los colaboradores de Sanidad Vegetal.
export const soloModuloSanidad = (user, accion = 'ver') =>
  Boolean(user) && !tienePermiso(user, PERMISOS_GENERAL[accion]) && tienePermiso(user, PERMISOS_SANIDAD[accion]);

// Alcance: por fincas asignadas (el usuario restringido ve los de sus fincas y su propia ficha; sin restricción, todos) y por
// módulo (`modulo` pedido, o Sanidad Vegetal si solo tiene esos permisos). Devuelve null si no hay restricción.
// `porPermisos: false`: sin la restricción de módulo por permisos (quien marca la cuadrilla ve a todos los de sus fincas).
export const alcanceColaboradores = (user, accion = 'ver', modulo = null, { porPermisos = true } = {}) => {
  const partes = [];
  const fincaIds = getFincaIdsPermitidas(user);
  if (fincaIds) partes.push({ [Op.or]: [{ fincaId: { [Op.in]: fincaIds } }, ...(user?.id ? [{ userId: user.id }] : [])] });
  const moduloEfectivo = porPermisos && soloModuloSanidad(user, accion) ? MODULO_SANIDAD : modulo;
  if (moduloEfectivo) partes.push({ modulo: moduloEfectivo });
  if (!partes.length) return null;
  return partes.length === 1 ? partes[0] : { [Op.and]: partes };
};
export const enAlcance = (colaborador, user, accion = 'ver') => {
  if (soloModuloSanidad(user, accion) && colaborador.modulo !== MODULO_SANIDAD) return false;
  const fincaIds = getFincaIdsPermitidas(user);
  return !fincaIds || (colaborador.fincaId && fincaIds.includes(colaborador.fincaId)) || (user?.id && colaborador.userId === user.id);
};

// Documento de identificación normalizado (sin espacios, puntos ni guiones) para no permitir dos colaboradores con la misma.
export const normalizarDocumento = (d) => (d ? String(d).replace(/[\s.-]/g, '').toUpperCase() : '');

// Lugar predeterminado: finca o lugar de asistencia (oficina...), nunca ambos. `soloFincasPropias`: el usuario restringido que
// administra colaboradores solo puede dejarlos en sus fincas (no en oficinas). Devuelve { fincaId, lugarId }.
async function resolverLugarPredeterminado({ fincaUuid, lugarUuid }, user, { soloFincasPropias = false } = {}) {
  if (fincaUuid && lugarUuid) throw ApiError.badRequest('Elige una finca o una oficina, no ambas');
  const restringido = user && getFincaIdsPermitidas(user);
  if (lugarUuid) {
    if (soloFincasPropias && restringido) throw ApiError.badRequest('Elige una de tus fincas asignadas');
    const lugar = await AsistenciaLugar.findOne({ where: { uuid: lugarUuid, estado: true }, attributes: ['id'] });
    if (!lugar) throw ApiError.badRequest('Lugar no encontrado o desactivado');
    return { fincaId: null, lugarId: lugar.id };
  }
  const fincaId = fincaUuid ? (await findFincaOrFail(fincaUuid)).id : null;
  if (fincaId && user) assertFincaPermitida(user, fincaId);
  if (!fincaId && soloFincasPropias && restringido) throw ApiError.badRequest('Elige la finca del colaborador (una de tus fincas asignadas)');
  return { fincaId, lugarId: null };
}

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
      alcance: alcanceColaboradores(user, 'ver', MODULOS_COLABORADOR.includes(query.modulo) ? query.modulo : null),
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

  // `user`: si se pasa, el colaborador debe estar en su alcance para la `accion` (si no, 404 como si no existiera).
  async getColaboradorByUuid(uuid, user = null, accion = 'ver') {
    const colaborador = await colaboradorRepository.findByUuid(uuid);
    if (!colaborador || (user && !enAlcance(colaborador, user, accion))) throw ApiError.notFound('Colaborador no encontrado');
    return colaborador;
  },

  async createColaborador(payload, actorId, actor = null) {
    // Con fincas asignadas solo se crean colaboradores en esas fincas (la finca es obligatoria); sin restricción, finca u oficina.
    const { fincaId, lugarId } = await resolverLugarPredeterminado(payload, actor, { soloFincasPropias: true });
    await validarDocumentoUnico(payload.documento);
    // Primer registro del colaborador: si el cargo escrito no existe, se crea en el maestro.
    const cargoResuelto = await resolverCargo(payload.cargo, { crearSiNoExiste: true, actorId });
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
          ...cargoResuelto,
          fincaId,
          lugarId,
          estado: payload.estado ?? true,
          // Quien solo tiene los permisos de Sanidad Vegetal crea siempre en ese módulo.
          modulo: soloModuloSanidad(actor, 'crear') ? MODULO_SANIDAD : MODULOS_COLABORADOR.includes(payload.modulo) ? payload.modulo : 'GENERAL',
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
    const colaborador = await this.getColaboradorByUuid(uuid, user, 'editar');
    if (payload.documento !== undefined) await validarDocumentoUnico(payload.documento, colaborador.id);

    const data = { updatedBy: actorId };
    if (payload.nombre !== undefined) data.nombre = capitalizarPalabras(payload.nombre);
    if (payload.apellido !== undefined) data.apellido = capitalizarPalabras(payload.apellido) || null;
    if (payload.documento !== undefined) data.documento = payload.documento || null;
    if (payload.telefono !== undefined) data.telefono = payload.telefono || null;
    if (payload.email !== undefined) data.email = payload.email || null;
    if (payload.cargo !== undefined) Object.assign(data, await resolverCargo(payload.cargo));
    if (payload.estado !== undefined) data.estado = payload.estado;
    // Cambiar de módulo solo con el permiso general de colaboradores.
    if (payload.modulo !== undefined && MODULOS_COLABORADOR.includes(payload.modulo) && !soloModuloSanidad(user, 'editar')) data.modulo = payload.modulo;
    if (payload.fincaUuid !== undefined || payload.lugarUuid !== undefined) {
      // No se puede mover a una finca fuera de las asignadas (ni dejarlo sin finca si el usuario está restringido).
      Object.assign(data, await resolverLugarPredeterminado(payload, user, { soloFincasPropias: true }));
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
    const colaborador = await this.getColaboradorByUuid(uuid, actor, 'editar');
    const user = await userLibreOrFail(userUuid, colaborador.id);
    await colaboradorRepository.update(colaborador, { userId: user.id, updatedBy: actorId });
    return colaboradorRepository.findByUuid(uuid);
  },

  async desvincularUsuario(uuid, actorId, actor = null) {
    const colaborador = await this.getColaboradorByUuid(uuid, actor, 'editar');
    await colaboradorRepository.update(colaborador, { userId: null, updatedBy: actorId });
    return colaboradorRepository.findByUuid(uuid);
  },

  // Crea un usuario del sistema a partir del colaborador y los deja vinculados.
  async crearUsuario(uuid, payload, actorId, actor = null) {
    const colaborador = await this.getColaboradorByUuid(uuid, actor, 'editar');
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
    const colaborador = await this.getColaboradorByUuid(uuid, user, 'eliminar');
    await colaboradorRepository.softDelete(colaborador, actorId);
  },

  // ─── Autoservicio: la ficha propia (colaborador vinculado al usuario de la sesión) ───
  async miFicha(user) {
    const c = await Colaborador.findOne({
      where: { userId: user.id },
      include: [
        { model: Finca, as: 'finca', attributes: ['uuid', 'nombre'] },
        { model: AsistenciaLugar, as: 'lugar', attributes: ['uuid', 'nombre', 'tipo'], paranoid: false },
      ],
    });
    if (!c) return null;
    const muestras = await ColaboradorRostro.count({ where: { colaboradorId: c.id } });
    const { asistenciaService } = await import('./asistencia.service.js');
    return {
      uuid: c.uuid,
      nombre: c.nombre,
      apellido: c.apellido,
      documento: c.documento,
      cargo: c.cargo,
      telefono: c.telefono,
      finca: c.finca ? { uuid: c.finca.uuid, nombre: c.finca.nombre } : null,
      lugar: c.lugar ? { uuid: c.lugar.uuid, nombre: c.lugar.nombre, tipo: c.lugar.tipo } : null,
      rostroMuestras: muestras,
      rostroEnrolado: muestras > 0,
      rostroConsentimiento: Boolean(c.rostroConsentimientoAt),
      solicitudRostro: await asistenciaService.ultimaSolicitudRostro(c.id),
    };
  },

  async crearMiFicha(payload, user) {
    if (await Colaborador.findOne({ where: { userId: user.id }, attributes: ['id'] })) throw ApiError.conflict('Ya tienes una ficha de colaborador');
    const { fincaId, lugarId } = await resolverLugarPredeterminado(payload, user);
    await validarDocumentoUnico(payload.documento);
    const yo = await User.findByPk(user.id, { attributes: ['id', 'nombre', 'apellido', 'email', 'cargo'] });
    // Sin cargo elegido, toma el del usuario (siempre del maestro de cargos).
    const cargoResuelto = await resolverCargo(payload.cargo || yo.cargo, { crearSiNoExiste: true, actorId: user.id });
    await colaboradorRepository.create({
      nombre: capitalizarPalabras(payload.nombre || yo.nombre),
      apellido: capitalizarPalabras(payload.apellido || yo.apellido) || null,
      documento: payload.documento || null,
      telefono: payload.telefono || null,
      email: yo.email || null,
      ...cargoResuelto,
      fincaId,
      lugarId,
      estado: true,
      userId: user.id,
      createdBy: user.id,
    });
    return this.miFicha(user);
  },

  // Editar la ficha propia: teléfono, cargo y lugar predeterminado. Nombre, apellido e identificación los cambia quien tenga
  // «Editar colaboradores».
  async actualizarMiFicha(payload, user) {
    const c = await Colaborador.findOne({ where: { userId: user.id } });
    if (!c) throw ApiError.notFound('Aún no tienes ficha de colaborador');
    const data = { updatedBy: user.id };
    if (payload.telefono !== undefined) data.telefono = payload.telefono || null;
    if (payload.cargo !== undefined) Object.assign(data, await resolverCargo(payload.cargo));
    if (payload.fincaUuid !== undefined || payload.lugarUuid !== undefined) Object.assign(data, await resolverLugarPredeterminado(payload, user));
    await c.update(data);
    return this.miFicha(user);
  },
};

export default colaboradorService;
