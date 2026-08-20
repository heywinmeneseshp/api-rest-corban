import { spawn } from 'node:child_process';
import { env } from '../../config/env.config.js';
import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../../utils/logger.js';

// Frase de confirmación exacta para el import — mismo criterio que
// resetDatos.service.js (FRASE_CONFIRMACION), para que un click accidental
// no pueda reemplazar toda la base de datos.
export const FRASE_CONFIRMACION_IMPORT = 'REEMPLAZAR TODO';

// Variables de entorno para mysqldump/mysql — la contraseña va por
// MYSQL_PWD (no como argumento de línea de comandos) para que no quede
// visible en `ps aux` / logs de proceso.
function envConexion() {
  return {
    ...process.env,
    MYSQL_PWD: env.db.password,
  };
}

export const backupService = {
  // Devuelve el proceso `mysqldump` ya corriendo — el controller conecta su
  // stdout directo a la respuesta HTTP (streaming, sin cargar el dump entero
  // en memoria). `--single-transaction` evita bloquear las tablas InnoDB
  // mientras se exporta.
  iniciarExport() {
    const args = [
      `--host=${env.db.host}`,
      `--port=${env.db.port}`,
      `--user=${env.db.user}`,
      '--single-transaction',
      '--routines',
      '--triggers',
      '--no-tablespaces',
      env.db.name,
    ];
    const proceso = spawn('mysqldump', args, { env: envConexion() });

    let stderr = '';
    proceso.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    proceso.on('close', (code) => {
      if (code !== 0) {
        logger.error('mysqldump terminó con error', { code, stderr: stderr.slice(0, 2000) });
      }
    });
    proceso.on('error', (error) => {
      logger.error('No se pudo ejecutar mysqldump', { message: error.message });
    });

    return proceso;
  },

  // DESTRUCTIVO: ejecuta el .sql recibido contra la base completa, tal cual
  // como restaurar un backup — reemplaza/sobrescribe lo que ese dump toque.
  // Requiere que el llamador ya haya validado FRASE_CONFIRMACION_IMPORT y el
  // rol Administrador (ver backup.controller.js / requireAdmin.middleware.js).
  async importarDump(sqlBuffer, actorId) {
    logger.warn('Iniciando importación (reemplazo) de la base de datos', { actorId, bytes: sqlBuffer.length });

    return new Promise((resolve, reject) => {
      const args = [`--host=${env.db.host}`, `--port=${env.db.port}`, `--user=${env.db.user}`, env.db.name];
      const proceso = spawn('mysql', args, { env: envConexion() });

      let stderr = '';
      proceso.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      proceso.on('close', (code) => {
        if (code === 0) {
          logger.warn('Importación de base de datos completada', { actorId });
          resolve();
        } else {
          logger.error('Importación de base de datos falló', { actorId, code, stderr: stderr.slice(0, 4000) });
          reject(ApiError.internal(`La importación falló (código ${code}): ${stderr.slice(0, 500) || 'sin detalle'}`));
        }
      });
      proceso.on('error', (error) => {
        logger.error('No se pudo ejecutar mysql (import)', { message: error.message });
        reject(ApiError.internal('No se pudo ejecutar el cliente mysql en el servidor para importar'));
      });

      proceso.stdin.write(sqlBuffer);
      proceso.stdin.end();
    });
  },
};

export default backupService;
