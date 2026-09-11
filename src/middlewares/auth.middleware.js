import { verifyAccessToken } from '../utils/jwt.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const auth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ')
    ? header.slice('Bearer '.length)
    : req.cookies?.accessToken;

  if (!token) {
    throw ApiError.unauthorized('Token de acceso no proporcionado');
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.id,
      uuid: payload.uuid,
      usuario: payload.usuario,
      roles: payload.roles || [],
      permissions: payload.permissions || [],
      // null = sin restricción (Administrador); arreglo (incl. vacío) =
      // solo esas fincas. Ver src/utils/fincaScope.js para cómo se usa.
      fincaIds: payload.fincaIds === null ? null : payload.fincaIds || [],
    };

    // La app móvil (Corbana) NO aplica la restricción de "fincas que puede
    // ver": un evaluador de campo puede trabajar en cualquier finca. El
    // scoping por finca asignada es solo para la web (app-corbana). El
    // cliente móvil se identifica con el header `X-Client-App: movil`.
    //
    // Compatibilidad temporal: las instalaciones de la app móvil hechas
    // ANTES de que se agregara ese header (React Native/Expo no tiene
    // auto-actualización OTA configurada en este proyecto, así que esos
    // dispositivos van a seguir sin mandarlo hasta que el usuario instale
    // una build nueva) igual deben quedar sin restricción — si no, un
    // evaluador de campo con finca(s) asignada(s) para la web se queda
    // bloqueado (403 "No tienes acceso a esta finca") al subir evaluaciones
    // de una planta fuera de esas fincas desde el celular. Como fallback se
    // detecta el cliente Android/OkHttp que usa React Network por defecto.
    // Quitar este fallback una vez que se confirme que todos los
    // dispositivos activos ya tienen la build con el header.
    const userAgent = req.headers['user-agent'] || '';
    if (req.headers['x-client-app'] === 'movil' || /^okhttp\//i.test(userAgent)) {
      req.user.fincaIds = null;
    }

    // Suplantación ("Ver como usuario", ver authService.impersonate): el
    // token es el REAL del usuario suplantado (por eso permissions/
    // fincaIds/roles arriba ya quedan correctos — así se ve exactamente lo
    // que esa persona vería). Pero `id`/`uuid`/`usuario` se pisan acá con
    // los del admin que está suplantando: son los que casi todo el código
    // usa como `createdBy`/`updatedBy` al crear o editar algo, y así lo que
    // se guarde queda a nombre del admin real, no del usuario suplantado
    // (pedido explícito). `req.user.viendoComo` guarda la identidad
    // suplantada por si algún caso puntual la necesita (ver
    // estimacionFinca.service.js#resolverVisibilidad, "solo mis
    // estimaciones" — ahí sí interesa saber quién está mirando de verdad).
    if (payload.impersonatedBy) {
      req.user.viendoComo = { id: payload.id, uuid: payload.uuid, usuario: payload.usuario };
      req.user.id = payload.impersonatedBy.id;
      req.user.uuid = payload.impersonatedBy.uuid;
      req.user.usuario = payload.impersonatedBy.usuario;
    }

    next();
  } catch {
    throw ApiError.unauthorized('Token de acceso inválido o expirado');
  }
});

export default auth;
