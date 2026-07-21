import { Op } from 'sequelize';
import { sequelize } from '../../database/connection.js';
import {
  User,
  Role,
  UsuarioRol,
  Finca,
  Lote,
  LoteAreaProduccion,
  Planta,
  Evaluacion,
  Infeccion,
  HojaInfectada,
  ConteoHojas,
  SumaBruta,
  EstadioHoja,
  RacimoMovimiento,
  MotivoRepique,
  MotivoRecuse,
  Semana,
  MenuItem,
  RefreshToken,
} from '../../database/associations.js';
import { ROLES } from '../../constants/roles.constants.js';
import { ApiError } from '../../utils/ApiError.js';

const FRASE_CONFIRMACION = 'BORRAR TODO';

// Tablas que NO se tocan porque son "de los seeders" (catálogo base del
// sistema, no datos ingresados por usuarios): roles, permisos,
// rol_permisos, categorías de planta, tipos de evaluación, configuraciones.
//
// Todo lo demás (fincas, lotes, plantas, evaluaciones, semanas, motivos,
// movimientos de racimos, usuarios y sus roles) se borra por completo,
// EXCEPTO los usuarios que hoy tienen el rol Administrador — para no
// dejar el sistema sin ningún admin con el que volver a entrar.
export const resetDatosService = {
  async resetDatosNoSeed(confirmacion) {
    if (confirmacion !== FRASE_CONFIRMACION) {
      throw ApiError.badRequest(`Debes escribir exactamente "${FRASE_CONFIRMACION}" para confirmar`);
    }

    const adminRole = await Role.findOne({ where: { nombre: ROLES.ADMINISTRADOR } });
    const adminUserIds = adminRole
      ? (await UsuarioRol.findAll({ where: { roleId: adminRole.id }, attributes: ['userId'] })).map((r) => r.userId)
      : [];

    return sequelize.transaction(async (transaction) => {
      const conteos = {};
      const del = async (Model, where = {}) => {
        conteos[Model.name] = await Model.destroy({ where, force: true, transaction });
      };

      // Hijos de evaluaciones primero (por las FK RESTRICT/relaciones 1:1 y 1:N)
      await del(EstadioHoja);
      await del(SumaBruta);
      await del(HojaInfectada);
      await del(Infeccion);
      await del(ConteoHojas);
      await del(Evaluacion);

      await del(RacimoMovimiento);
      await del(LoteAreaProduccion);
      await del(Planta);
      await del(Lote);
      await del(Finca);

      await del(MotivoRepique);
      await del(MotivoRecuse);
      await del(Semana);
      await del(MenuItem);

      await del(RefreshToken);

      // Usuarios: se conservan los que hoy tienen el rol Administrador
      // (sus usuarios_roles y refresh_tokens se borran en cascada al
      // borrar el usuario, así que no hace falta tocarlos aparte).
      conteos.User = await User.destroy({
        where: { id: { [Op.notIn]: adminUserIds.length ? adminUserIds : [0] } },
        force: true,
        transaction,
      });

      return { conteos, adminsConservados: adminUserIds.length };
    });
  },
};

export default resetDatosService;
