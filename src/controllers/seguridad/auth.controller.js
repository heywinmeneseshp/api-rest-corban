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
};

export default authController;
