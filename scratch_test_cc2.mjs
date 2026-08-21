import 'dotenv/config';
import { sequelize } from './src/database/connection.js';
import { configuracionService } from './src/services/sistema/configuracion.service.js';
import { laborCulturalService } from './src/services/agricola/laborCultural.service.js';
import { Role, User, setupAssociations } from './src/database/associations.js';

setupAssociations();

async function main() {
  await sequelize.authenticate();

  const antes = await configuracionService.getLaborRevisorCc();
  console.log('CC antes:', JSON.stringify(antes));

  const rol = await Role.findOne({ order: [['id', 'ASC']] });
  const usuario = await User.findOne({ order: [['id', 'ASC']] });
  console.log('probando con rol:', rol.nombre, rol.uuid, '| usuario:', usuario.email, usuario.uuid);

  await configuracionService.setLaborRevisorCc(
    { correos: ['suelto@ejemplo.com'], rolesUuids: [rol.uuid], usuariosUuids: [usuario.uuid] },
    null,
  );

  // resolverCcCompleto no está exportado directamente del service object,
  // así que probamos indirectamente vía enviarCorreoRevision... en vez de
  // eso, probamos la resolución llamando al servicio de config + una
  // consulta manual equivalente, para no disparar un correo real.
  const guardado = await configuracionService.getLaborRevisorCc();
  console.log('CC guardado:', JSON.stringify(guardado));

  const usuariosPorRol = await User.findAll({
    where: { estado: true },
    include: [{ model: Role, as: 'roles', where: { uuid: guardado.rolesUuids }, through: { attributes: [] } }],
  });
  console.log('usuarios resueltos por rol:', usuariosPorRol.map((u) => u.email));

  const usuariosPuntuales = await User.findAll({ where: { uuid: guardado.usuariosUuids, estado: true } });
  console.log('usuarios resueltos puntuales:', usuariosPuntuales.map((u) => u.email));

  // Revertir a vacío.
  await configuracionService.setLaborRevisorCc({ correos: [], rolesUuids: [], usuariosUuids: [] }, null);
  const final = await configuracionService.getLaborRevisorCc();
  console.log('CC final (vacío):', JSON.stringify(final));

  await sequelize.close();
  console.log('OK');
}

main().catch((err) => {
  console.error('FALLO:', err);
  process.exit(1);
});
