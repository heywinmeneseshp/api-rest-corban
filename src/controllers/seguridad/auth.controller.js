import { authService } from '../../services/seguridad/auth.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const authController = {
  login: asyncHandler(async (req, res) => {
    const { usuario, password } = req.body;
    const result = await authService.login(usuario, password);
    ApiResponse.send(res, { message: 'Inicio de sesión exitoso', data: result });
  }),

  refresh: asyncHandler(async (req, res) => {
    const result = await authService.refresh(req.body.refreshToken);
    ApiResponse.send(res, { message: 'Token renovado correctamente', data: result });
  }),

  logout: asyncHandler(async (req, res) => {
    await authService.logout(req.body.refreshToken);
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
