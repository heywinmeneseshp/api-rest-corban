import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { sequelize } from '../../database/connection.js';
import { User, Role, Finca } from '../../database/associations.js';
import { userRepository } from '../../repositories/seguridad/user.repository.js';
import { mailService } from '../sistema/mail.service.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { parseBulkFile } from '../../utils/bulkFileParser.js';

const SALT_ROUNDS = 10;

// A diferencia de motivoRepique/produccionSemanal (estado en blanco =
// activo), acá en blanco significa "no tocar el estado" al actualizar un
// usuario existente — para que volver a subir el mismo archivo sin la
// columna estado no reactive por accidente una cuenta que alguien
// desactivó a mano. En una fila de creación (usuario nuevo) sí aplica el
// default: activo.
function parseEstadoUsuario(valor) {
  if (valor === undefined || valor === '') return undefined;
  const texto = String(valor).trim().toLowerCase();
  return !['inactivo', 'false', '0', 'no'].includes(texto);
}

const findRoleByUuidOrFail = async (roleUuid) => {
  const role = await Role.findOne({ where: { uuid: roleUuid } });
  if (!role) throw ApiError.notFound('Rol no encontrado');
  return role;
};

const findFincaByUuidOrFail = async (fincaUuid) => {
  const finca = await Finca.findOne({ where: { uuid: fincaUuid } });
  if (!finca) throw ApiError.notFound('Finca no encontrada');
  return finca;
};

export const userService = {
  async listUsers(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await userRepository.findAndCountAll({
      limit,
      offset,
      search: query.search,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getUserByUuid(uuid) {
    const user = await userRepository.findByUuid(uuid);
    if (!user) throw ApiError.notFound('Usuario no encontrado');
    return user;
  },

  async createUser(payload, actorId) {
    const existing = await userRepository.findByUsuarioOrEmail(payload.usuario, payload.email);
    if (existing) {
      throw ApiError.conflict('El usuario o email ya está registrado');
    }

    const hashedPassword = await bcrypt.hash(payload.password, SALT_ROUNDS);

    const user = await sequelize.transaction((transaction) =>
      userRepository.create(
        {
          usuario: payload.usuario,
          nombre: payload.nombre,
          apellido: payload.apellido,
          email: payload.email,
          password: hashedPassword,
          estado: payload.estado ?? true,
          cargo: payload.cargo || null,
          createdBy: actorId,
        },
        { transaction },
      ),
    );
    return user.toSafeJSON();
  },

  async updateUser(uuid, payload, actorId) {
    const user = await this.getUserByUuid(uuid);

    if (payload.usuario || payload.email) {
      const existing = await userRepository.findByUsuarioOrEmail(
        payload.usuario ?? user.usuario,
        payload.email ?? user.email,
      );
      if (existing && existing.id !== user.id) {
        throw ApiError.conflict('El usuario o email ya está registrado');
      }
    }

    const data = { ...payload, updatedBy: actorId };
    if (payload.password) {
      data.password = await bcrypt.hash(payload.password, SALT_ROUNDS);
    }

    const updated = await userRepository.update(user, data);
    return updated.toSafeJSON();
  },

  async deleteUser(uuid, actorId) {
    const user = await this.getUserByUuid(uuid);
    await userRepository.softDelete(user, actorId);
  },

  async bulkResetPassword(uuids) {
    if (!uuids || !Array.isArray(uuids) || uuids.length === 0) {
      throw ApiError.badRequest('Debes enviar al menos un usuario');
    }

    const users = await User.findAll({ where: { uuid: uuids } });

    if (users.length === 0) {
      throw ApiError.notFound('Ningún usuario encontrado');
    }

    const results = [];

    for (const user of users) {
      const newPassword = crypto.randomBytes(4).toString('hex');
      const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
      await user.update({ password: hashedPassword });
      try {
        await mailService.sendPasswordReset(user.toSafeJSON(), newPassword);
        results.push({ uuid: user.uuid, usuario: user.usuario, email: user.email, ok: true });
      } catch {
        results.push({ uuid: user.uuid, usuario: user.usuario, email: user.email, ok: false });
      }
    }

    return results;
  },

  async listUserRoles(uuid) {
    const user = await this.getUserByUuid(uuid);
    return user.roles || [];
  },

  // Igual que en role.service.js: se evita el include de roles (más
  // liviano) y no se re-consulta el usuario completo al final.
  async assignRole(uuid, roleUuid, actorId) {
    const user = await userRepository.findByUuid(uuid, { includeRoles: false });
    if (!user) throw ApiError.notFound('Usuario no encontrado');
    const role = await findRoleByUuidOrFail(roleUuid);
    await userRepository.assignRole(user.id, role.id, actorId);
  },

  async removeRole(uuid, roleUuid) {
    const user = await userRepository.findByUuid(uuid, { includeRoles: false });
    if (!user) throw ApiError.notFound('Usuario no encontrado');
    const role = await findRoleByUuidOrFail(roleUuid);
    await userRepository.removeRole(user.id, role.id);
  },

  async listUserFincas(uuid) {
    const user = await userRepository.findByUuid(uuid, { includeRoles: false, includeFincas: true });
    if (!user) throw ApiError.notFound('Usuario no encontrado');
    return user.fincas || [];
  },

  async assignFinca(uuid, fincaUuid, actorId) {
    const user = await userRepository.findByUuid(uuid, { includeRoles: false });
    if (!user) throw ApiError.notFound('Usuario no encontrado');
    const finca = await findFincaByUuidOrFail(fincaUuid);
    await userRepository.assignFinca(user.id, finca.id, actorId);
  },

  async removeFinca(uuid, fincaUuid) {
    const user = await userRepository.findByUuid(uuid, { includeRoles: false });
    if (!user) throw ApiError.notFound('Usuario no encontrado');
    const finca = await findFincaByUuidOrFail(fincaUuid);
    await userRepository.removeFinca(user.id, finca.id);
  },

  // Cargue masivo desde .csv/.xlsx, para crear y actualizar usuarios a la
  // vez. Columnas esperadas: usuario, nombre, apellido, email, cargo
  // (opcional), estado (opcional: activo/inactivo — en blanco no toca el
  // estado de un usuario existente, y activa por defecto uno nuevo), roles
  // (opcional, nombres de rol separados por coma) y fincas (opcional,
  // códigos de finca separados por coma). La contraseña siempre se genera
  // sola (igual que en bulkResetPassword) y se envía por correo — nunca se
  // recibe por archivo. Clave natural: usuario. Sigue el mismo criterio que
  // motivoRepique/produccionSemanal (siempre inserta/actualiza lo válido y
  // reporta errores para el resto), no el de racimoMovimiento (que aborta
  // todo si hay un solo error) — acá no aplica esa complejidad.
  async bulkCreateUsuarios(file, actorId, { dryRun = false } = {}) {
    const rows = parseBulkFile(file);
    if (rows.length === 0) throw ApiError.badRequest('El archivo no tiene filas para procesar');

    const errores = [];
    const filasValidas = [];

    for (let i = 0; i < rows.length; i += 1) {
      const fila = i + 2;
      const row = rows[i];
      const usuario = String(row.usuario || '').trim();
      const nombre = String(row.nombre || '').trim();
      const apellido = String(row.apellido || '').trim();
      const email = String(row.email || '').trim();

      if (!usuario || !nombre || !apellido || !email) {
        errores.push({ fila, mensaje: 'Faltan columnas requeridas: usuario, nombre, apellido, email' });
        continue;
      }

      const cargo = row.cargo ? String(row.cargo).trim() : undefined;
      const estado = parseEstadoUsuario(row.estado);
      const rolesTexto = row.roles ? String(row.roles).split(',').map((r) => r.trim()).filter(Boolean) : [];
      const fincasTexto = row.fincas ? String(row.fincas).split(',').map((f) => f.trim()).filter(Boolean) : [];

      filasValidas.push({ fila, usuario, nombre, apellido, email, cargo, estado, rolesTexto, fincasTexto });
    }

    // Si el mismo usuario aparece varias veces en el archivo, se procesa
    // una sola vez con los valores de su última aparición (mismo criterio
    // que motivoRepique).
    const porUsuario = new Map();
    for (const f of filasValidas) porUsuario.set(f.usuario, f);
    const filasUnicas = [...porUsuario.values()];

    const usuarios = filasUnicas.map((f) => f.usuario);
    const emails = filasUnicas.map((f) => f.email);
    const existentesPorUsuario = usuarios.length ? await userRepository.findByUsuarios(usuarios) : [];
    const existentesPorEmail = emails.length ? await userRepository.findByEmails(emails) : [];
    const mapaExistentesPorUsuario = new Map(existentesPorUsuario.map((u) => [u.usuario, u]));
    const mapaExistentesPorEmail = new Map(existentesPorEmail.map((u) => [u.email, u]));

    // Roles/fincas mencionados en el archivo se resuelven una sola vez
    // (nombre de rol / código de finca) en vez de una consulta por fila.
    const nombresRoles = [...new Set(filasUnicas.flatMap((f) => f.rolesTexto))];
    const codigosFincas = [...new Set(filasUnicas.flatMap((f) => f.fincasTexto))];
    const rolesEncontrados = nombresRoles.length ? await Role.findAll({ where: { nombre: nombresRoles } }) : [];
    const fincasEncontradas = codigosFincas.length ? await Finca.findAll({ where: { codigo: codigosFincas } }) : [];
    const mapaRoles = new Map(rolesEncontrados.map((r) => [r.nombre, r]));
    const mapaFincas = new Map(fincasEncontradas.map((f) => [f.codigo, f]));

    let creados = 0;
    let actualizados = 0;
    const nuevosParaCorreo = [];

    if (!dryRun) {
      await sequelize.transaction(async (transaction) => {
        for (const f of filasUnicas) {
          // Un email ya usado por OTRO usuario (login distinto) es un
          // conflicto real — se reporta como error y no se procesa esa
          // fila, en vez de fallar toda la transacción.
          const usuarioPorEmail = mapaExistentesPorEmail.get(f.email);
          const usuarioExistente = mapaExistentesPorUsuario.get(f.usuario);
          if (usuarioPorEmail && (!usuarioExistente || usuarioPorEmail.id !== usuarioExistente.id)) {
            errores.push({ fila: f.fila, mensaje: `El email ${f.email} ya está en uso por otro usuario` });
            continue;
          }

          // Roles/fincas desconocidos: error duro para esa fila, no se
          // adivina ni se ignora silenciosamente.
          const rolesDesconocidos = f.rolesTexto.filter((r) => !mapaRoles.has(r));
          const fincasDesconocidas = f.fincasTexto.filter((c) => !mapaFincas.has(c));
          if (rolesDesconocidos.length || fincasDesconocidas.length) {
            const partes = [];
            if (rolesDesconocidos.length) partes.push(`rol(es) no encontrado(s): ${rolesDesconocidos.join(', ')}`);
            if (fincasDesconocidas.length) partes.push(`finca(s) no encontrada(s): ${fincasDesconocidas.join(', ')}`);
            errores.push({ fila: f.fila, mensaje: partes.join('; ') });
            continue;
          }

          const roleIds = f.rolesTexto.map((r) => mapaRoles.get(r).id);
          const fincaIds = f.fincasTexto.map((c) => mapaFincas.get(c).id);

          let user;
          if (usuarioExistente) {
            const data = {
              nombre: f.nombre,
              apellido: f.apellido,
              email: f.email,
              cargo: f.cargo ?? usuarioExistente.cargo,
              updatedBy: actorId,
            };
            if (f.estado !== undefined) data.estado = f.estado;
            user = await userRepository.update(usuarioExistente, data, { transaction });
            actualizados += 1;
          } else {
            const passwordGenerada = crypto.randomBytes(4).toString('hex');
            const hashedPassword = await bcrypt.hash(passwordGenerada, SALT_ROUNDS);
            user = await userRepository.create(
              {
                usuario: f.usuario,
                nombre: f.nombre,
                apellido: f.apellido,
                email: f.email,
                password: hashedPassword,
                estado: f.estado ?? true,
                cargo: f.cargo || null,
                createdBy: actorId,
              },
              { transaction },
            );
            creados += 1;
            nuevosParaCorreo.push({ user, passwordGenerada });
          }

          if (f.rolesTexto.length) await userRepository.setRoles(user.id, roleIds, actorId, { transaction });
          if (f.fincasTexto.length) await userRepository.setFincas(user.id, fincaIds, actorId, { transaction });
        }
      });

      // El envío de correo va después de confirmar la transacción, y con
      // try/catch por usuario (mismo criterio que bulkResetPassword) para
      // que un correo fallido no eche para atrás usuarios ya creados.
      for (const { user, passwordGenerada } of nuevosParaCorreo) {
        try {
          await mailService.sendPasswordReset(user.toSafeJSON(), passwordGenerada);
        } catch {
          errores.push({ fila: null, mensaje: `Usuario ${user.usuario} creado, pero falló el envío del correo con la contraseña` });
        }
      }
    } else {
      creados = filasUnicas.filter((f) => !mapaExistentesPorUsuario.has(f.usuario)).length;
      actualizados = filasUnicas.length - creados;
    }

    return { totalFilas: rows.length, usuariosCreados: creados, usuariosActualizados: actualizados, errores };
  },
};

export default userService;
