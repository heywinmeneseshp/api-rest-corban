import { authService } from '../../services/seguridad/auth.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const isProd = process.env.NODE_ENV === 'production';
const cookieOpts = (maxAgeMs) => ({
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? 'none' : 'lax',
  path: '/',
  maxAge: maxAgeMs,
  ...(isProd ? { domain: '.banarica.cloud' } : {}),
});

export const authController = {
  login: asyncHandler(async (req, res) => {
    const { usuario, password } = req.body;
    const result = await authService.login(usuario, password);
    // httpOnly cookies para web (móvil sigue usando Bearer del body)
    res.cookie('accessToken', result.accessToken, cookieOpts(15 * 60 * 1000));
    res.cookie('refreshToken', result.refreshToken, cookieOpts(7 * 24 * 60 * 60 * 1000));
    ApiResponse.send(res, { message: 'Inicio de sesión exitoso', data: result });
  }),

  refresh: asyncHandler(async (req, res) => {
    const rawToken = req.body.refreshToken || req.cookies?.refreshToken;
    const result = await authService.refresh(rawToken);
    res.cookie('accessToken', result.accessToken, cookieOpts(15 * 60 * 1000));
    res.cookie('refreshToken', result.refreshToken, cookieOpts(7 * 24 * 60 * 60 * 1000));
    ApiResponse.send(res, { message: 'Token renovado correctamente', data: result });
  }),

  logout: asyncHandler(async (req, res) => {
    const rawToken = req.body.refreshToken || req.cookies?.refreshToken;
    if (rawToken) await authService.logout(rawToken);
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/' });
    ApiResponse.send(res, { message: 'Sesión cerrada correctamente' });
  }),

  me: asyncHandler(async (req, res) => {
    const user = await authService.me(req.user.id);
    ApiResponse.send(res, { message: 'Usuario autenticado obtenido correctamente', data: user });
  }),

  updateProfile: asyncHandler(async (req, res) => {
    const user = await authService.updateProfile(req.user.id, req.body);
    ApiResponse.send(res, { message: 'Perfil actualizado correctamente', data: user });
  }),

  subirFirma: asyncHandler(async (req, res) => {
    const user = await authService.subirFirma(req.user.id, req.file);
    ApiResponse.send(res, { message: 'Firma guardada correctamente', data: user });
  }),

  quitarFirma: asyncHandler(async (req, res) => {
    const user = await authService.quitarFirma(req.user.id);
    ApiResponse.send(res, { message: 'Firma eliminada', data: user });
  }),

  // Devuelve la imagen PNG (la propia con /me/firma, o la de otro usuario con /firmas/:uuid para los documentos).
  obtenerFirma: asyncHandler(async (req, res, next) => {
    try {
      const { stream } = await authService.obtenerFirma(req.params.uuid ? { userUuid: req.params.uuid } : { userId: req.user.id });
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'private, no-store');
      stream.on('error', (error) => next(error));
      stream.pipe(res);
    } catch (error) {
      next(error);
    }
  }),

  changePassword: asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const result = await authService.changePassword(req.user.id, currentPassword, newPassword);
    ApiResponse.send(res, { message: 'Contraseña actualizada correctamente', data: result });
  }),

  forgotPassword: asyncHandler(async (req, res) => {
    await authService.forgotPassword(req.body.usuarioOrEmail);
    // Mensaje genérico siempre, exista o no el usuario/email — ver el
    // comentario en authService.forgotPassword.
    ApiResponse.send(res, {
      message: 'Si el usuario o correo existe, se enviaron instrucciones para restablecer la contraseña.',
    });
  }),
};

export default authController;
