import { User, Role } from '../database/associations.js';

// Resuelve una config de destinatarios (correos sueltos + roles + usuarios
// puntuales) a una lista real de personas para mandar correo — con nombre,
// para poder personalizar el saludo, y deduplicada por email (si alguien
// aparece por rol Y por selección puntual, o repetido en varios roles,
// solo se manda una vez). Mismo criterio que ya usaban
// evaluacion.service.js#resolverDestinatariosAlertas y
// laborCultural.service.js#resolverCcCompleto, ahora compartido para no
// triplicar la misma lógica con el módulo de Comunicados.
// Normaliza una lista que debería ser de uuids: acepta tanto strings
// sueltos como objetos { uuid, ... } (el TagPicker del panel emite objetos,
// y una config vieja pudo haberse guardado con ellos adentro — sin esto,
// Sequelize revienta con "Invalid value { uuid, label, sublabel }" al
// armar el WHERE).
function soloUuids(lista) {
  if (!Array.isArray(lista)) return [];
  return lista
    .map((x) => (typeof x === 'string' ? x : x && typeof x === 'object' ? x.uuid : null))
    .filter((x) => typeof x === 'string' && x.length > 0);
}

export async function resolverDestinatarios({ correos = [], rolesUuids = [], usuariosUuids = [] } = {}) {
  rolesUuids = soloUuids(rolesUuids);
  usuariosUuids = soloUuids(usuariosUuids);
  const porEmail = new Map();

  for (const email of correos) {
    const limpio = String(email || '').trim().toLowerCase();
    if (limpio && !porEmail.has(limpio)) {
      porEmail.set(limpio, { email: limpio, nombre: null });
    }
  }

  if (rolesUuids?.length) {
    const usuariosPorRol = await User.findAll({
      where: { estado: true },
      include: [{ model: Role, as: 'roles', where: { uuid: rolesUuids }, through: { attributes: [] } }],
    });
    for (const u of usuariosPorRol) {
      if (!u.email) continue;
      const limpio = u.email.trim().toLowerCase();
      if (!porEmail.has(limpio)) porEmail.set(limpio, { email: u.email, nombre: `${u.nombre} ${u.apellido}`.trim() });
    }
  }

  if (usuariosUuids?.length) {
    const usuariosPuntuales = await User.findAll({ where: { uuid: usuariosUuids, estado: true } });
    for (const u of usuariosPuntuales) {
      if (!u.email) continue;
      const limpio = u.email.trim().toLowerCase();
      if (!porEmail.has(limpio)) porEmail.set(limpio, { email: u.email, nombre: `${u.nombre} ${u.apellido}`.trim() });
    }
  }

  return [...porEmail.values()];
}

export default resolverDestinatarios;
