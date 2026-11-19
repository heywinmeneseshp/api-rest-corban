import { QueryTypes } from 'sequelize';
import { sequelize } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';

// Notificaciones push de la app móvil por Expo Push (https://exp.host). Cada celular registra su token al iniciar sesión.
// Destinatarios: usuarios activos cuyo rol tiene el permiso dado; si el usuario tiene fincas asignadas, solo recibe los avisos
// de esas fincas (sin fincas asignadas = todas).
const URL_EXPO = 'https://exp.host/--/api/v2/push/send';

export const pushService = {
  async registrarToken(userId, { token, plataforma }) {
    await sequelize.query(
      `INSERT INTO push_tokens (user_id, token, plataforma, activo, created_at, updated_at) VALUES (:userId, :token, :plataforma, 1, NOW(), NOW())
       ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), plataforma = VALUES(plataforma), updated_at = NOW()`,
      { replacements: { userId, token, plataforma: plataforma || null } },
    );
    return this.estado(userId, token);
  },

  async quitarToken(token) {
    await sequelize.query('DELETE FROM push_tokens WHERE token = :token', { replacements: { token } });
  },

  async estado(userId, token) {
    const [fila] = await sequelize.query('SELECT activo FROM push_tokens WHERE token = :token AND user_id = :userId', {
      replacements: { token, userId },
      type: QueryTypes.SELECT,
    });
    return { registrado: Boolean(fila), activo: fila ? Boolean(fila.activo) : false };
  },

  async cambiarActivo(userId, token, activo) {
    await sequelize.query('UPDATE push_tokens SET activo = :activo, updated_at = NOW() WHERE token = :token AND user_id = :userId', {
      replacements: { token, userId, activo: activo ? 1 : 0 },
    });
    return this.estado(userId, token);
  },

  // Tokens activos de los usuarios con el permiso (por rol) y acceso a la finca. `excluirUserId`: quien hizo la acción.
  async tokensConPermiso(codigo, { fincaId = null, excluirUserId = null } = {}) {
    const filas = await sequelize.query(
      `SELECT DISTINCT pt.token
         FROM push_tokens pt
         JOIN users u ON u.id = pt.user_id AND u.deleted_at IS NULL AND u.estado = 1
         JOIN usuarios_roles ur ON ur.user_id = u.id
         JOIN rol_permisos rp ON rp.role_id = ur.role_id
         JOIN permisos p ON p.id = rp.permiso_id AND p.codigo = :codigo
        WHERE pt.activo = 1
          ${excluirUserId ? 'AND u.id <> :excluirUserId' : ''}
          ${
            fincaId
              ? `AND (NOT EXISTS (SELECT 1 FROM usuario_fincas uf WHERE uf.user_id = u.id)
                  OR EXISTS (SELECT 1 FROM usuario_fincas uf WHERE uf.user_id = u.id AND uf.finca_id = :fincaId))`
              : ''
          }`,
      { replacements: { codigo, fincaId, excluirUserId }, type: QueryTypes.SELECT },
    );
    return filas.map((f) => f.token);
  },

  // No lanza errores: quien llama no espera ni falla si Expo no responde (solo queda en el log).
  async enviarAPermiso(codigo, { titulo, cuerpo, data = {} }, opciones = {}) {
    try {
      const tokens = await this.tokensConPermiso(codigo, opciones);
      for (let i = 0; i < tokens.length; i += 100) {
        const lote = tokens.slice(i, i + 100);
        const res = await fetch(URL_EXPO, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(lote.map((to) => ({ to, title: titulo, body: cuerpo, data, sound: 'default', channelId: 'default', priority: 'high' }))),
          signal: AbortSignal.timeout(15000),
        });
        const json = await res.json().catch(() => ({}));
        // Celulares que desinstalaron la app: se borra su token.
        const muertos = (json.data || []).map((t, j) => (t?.details?.error === 'DeviceNotRegistered' ? lote[j] : null)).filter(Boolean);
        if (muertos.length) await sequelize.query('DELETE FROM push_tokens WHERE token IN (:muertos)', { replacements: { muertos } });
      }
      return tokens.length;
    } catch (error) {
      logger.error('No se pudo enviar la notificación push', { message: error.message, codigo });
      return 0;
    }
  },
};
