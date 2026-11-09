import { createGzip } from 'node:zlib';
import { backupService } from '../services/sistema/backup.service.js';
import { listarRespaldos, subirRespaldo, eliminarFotoDeDrive } from '../services/googleDrive/cargueFotosLabor.js';
import { logger } from '../utils/logger.js';

// Copia diaria de la base de datos a Google Drive (GOOGLE_DRIVE_FOLDER / Respaldos_Base_Datos), desde las 02:00 de Bogotá.
// Revisa cada hora: si la copia del día ya está en Drive no hace nada, así un reinicio no la repite ni la pierde.
// Conserva las copias de los últimos 14 días y, de ahí para atrás, la del domingo de las últimas 8 semanas.
const HORA_OBJETIVO_UTC = 7; // 02:00 Bogotá
const INTERVALO_CHEQUEO_MS = 60 * 60 * 1000;
const DIAS_DIARIAS = 14;
const SEMANAS_SEMANALES = 8;
const MS_DIA = 86400000;
const PREFIJO = 'respaldo_corbana_';

const hoyBogota = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
const fechaDe = (nombre) => (nombre.match(/^respaldo_corbana_(\d{4}-\d{2}-\d{2})\.sql\.gz$/) || [])[1] || null;

let enCurso = false;

// Genera el dump, lo comprime y lo sube. Si mysqldump falla, borra lo subido y lanza el error.
export async function crearRespaldo() {
  const nombre = `${PREFIJO}${hoyBogota()}.sql.gz`;
  const proceso = backupService.iniciarExport();
  const fin = new Promise((resolve) => proceso.on('close', resolve));
  const subido = await subirRespaldo(nombre, proceso.stdout.pipe(createGzip()));
  const codigo = await fin;
  if (codigo !== 0) {
    await eliminarFotoDeDrive(subido.id);
    throw new Error(`mysqldump terminó con código ${codigo}`);
  }
  return { nombre, bytes: Number(subido.size || 0) };
}

async function limpiarAntiguos(archivos) {
  const hoy = new Date(`${hoyBogota()}T12:00:00Z`).getTime();
  for (const a of archivos) {
    const fecha = fechaDe(a.name);
    if (!fecha) continue;
    const t = new Date(`${fecha}T12:00:00Z`);
    const dias = Math.round((hoy - t.getTime()) / MS_DIA);
    const conservar = dias < DIAS_DIARIAS || (t.getUTCDay() === 0 && dias < SEMANAS_SEMANALES * 7);
    if (!conservar) await eliminarFotoDeDrive(a.id);
  }
}

async function chequear() {
  if (enCurso || new Date().getUTCHours() < HORA_OBJETIVO_UTC) return;
  enCurso = true;
  try {
    const archivos = await listarRespaldos();
    if (!archivos.some((a) => a.name === `${PREFIJO}${hoyBogota()}.sql.gz`)) {
      const r = await crearRespaldo();
      logger.info('Copia de seguridad de la base de datos subida a Google Drive', r);
    }
    await limpiarAntiguos(await listarRespaldos());
  } catch (error) {
    logger.error('La copia de seguridad de la base de datos falló', { message: error.message });
  } finally {
    enCurso = false;
  }
}

export function iniciarJobRespaldoBaseDatos() {
  if (process.env.NODE_ENV !== 'production') return; // solo el servidor real respalda
  setInterval(chequear, INTERVALO_CHEQUEO_MS);
  chequear();
}
