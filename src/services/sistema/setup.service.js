import bcrypt from 'bcrypt';
import { sequelize } from '../../database/connection.js';
import { User, Role, UsuarioRol } from '../../database/associations.js';
import { ROLES } from '../../constants/roles.constants.js';
import { ApiError } from '../../utils/ApiError.js';

const SALT_ROUNDS = 10;

export const setupService = {
  // La configuración inicial ya se hizo si existe al menos un usuario — a
  // partir de ahí este flujo queda cerrado (no es un formulario de registro
  // abierto, es exclusivamente para crear el primer administrador).
  async getEstado() {
    const totalUsuarios = await User.count();
    return { requiereSetup: totalUsuarios === 0 };
  },

  async completarSetup(payload) {
    const totalUsuarios = await User.count();
    if (totalUsuarios > 0) {
      throw ApiError.conflict('La configuración inicial ya fue completada');
    }

    const adminRole = await Role.findOne({ where: { nombre: ROLES.ADMINISTRADOR } });
    if (!adminRole) {
      throw ApiError.internal(
        'No existe el rol Administrador todavía — esperá a que terminen de aplicarse las migraciones/seeders e intentá de nuevo.',
      );
    }

    const hashedPassword = await bcrypt.hash(payload.password, SALT_ROUNDS);

    const user = await sequelize.transaction(async (transaction) => {
      const nuevoUsuario = await User.create(
        {
          usuario: payload.usuario,
          nombre: payload.nombre,
          apellido: payload.apellido,
          email: payload.email,
          password: hashedPassword,
          estado: true,
        },
        { transaction },
      );

      // Se autoasigna como creador del rol — es el primer usuario, no hay
      // ningún otro actor todavía.
      await UsuarioRol.create(
        { userId: nuevoUsuario.id, roleId: adminRole.id, createdBy: nuevoUsuario.id },
        { transaction },
      );

      return nuevoUsuario;
    });

    return {
      uuid: user.uuid,
      usuario: user.usuario,
      nombre: user.nombre,
      apellido: user.apellido,
      email: user.email,
    };
  },
};

export default setupService;
