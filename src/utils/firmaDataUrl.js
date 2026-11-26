import { User } from '../database/associations.js';
import { ApiError } from './ApiError.js';
import { authService } from '../services/seguridad/auth.service.js';

// Firma dibujada en la app o en la web (data URL PNG) -> Buffer; null si no viene o no es un PNG válido (máx. 1 MB).
export function firmaDesdeDataUrl(dataUrl) {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || '').trim());
  if (!m) return null;
  const buffer = Buffer.from(m[1], 'base64');
  return buffer.length > 100 && buffer.length < 1024 * 1024 ? buffer : null;
}

// Antes de aprobar un documento: si el usuario no tiene firma en su perfil, exige la firma dibujada (`firma`, data URL) y la
// guarda en su perfil; las siguientes veces ya no se pide. El cliente reconoce el error por el campo «firma».
export async function asegurarFirmaUsuario(userId, firma, mensaje = 'Es la primera vez que apruebas: dibuja tu firma (quedará guardada en tu perfil)') {
  if (!userId) return;
  const usuario = await User.findByPk(userId, { attributes: ['id', 'firmaDriveId'] });
  if (!usuario || usuario.firmaDriveId) return;
  const buffer = firmaDesdeDataUrl(firma);
  if (!buffer) throw ApiError.badRequest(mensaje, [{ field: 'firma', message: 'FIRMA_REQUERIDA' }]);
  await authService.subirFirma(userId, { buffer, originalname: 'firma.png', mimetype: 'image/png' });
}
