import { google } from 'googleapis';
import { Readable } from 'node:stream';
import path from 'node:path';
import { logger } from '../../utils/logger.js';

// Mismo patrón que api-rest-banarica (services/googleDrive/cargueFotos.js):
// cuenta de servicio con las credenciales completas en una sola variable de
// entorno (JSON como string), scope 'drive.file'. La carpeta destino tiene
// que ser una unidad compartida (Shared Drive) con la cuenta de servicio
// como Administrador de contenido — las cuentas de servicio no tienen cuota
// propia en "Mi unidad".
let drive = null;

const getDrive = () => {
  if (drive) return drive;

  if (!process.env.GOOGLE_DRIVE_CREDENTIALS) {
    throw new Error('Falta GOOGLE_DRIVE_CREDENTIALS en el entorno');
  }

  let creds;
  try {
    creds = JSON.parse(process.env.GOOGLE_DRIVE_CREDENTIALS);
  } catch (error) {
    throw new Error(`Error al parsear GOOGLE_DRIVE_CREDENTIALS: ${error.message}`);
  }

  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });

  drive = google.drive({ version: 'v3', auth });
  return drive;
};

const SHARED_DRIVE_OPTIONS = {
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
};

const normalizarTexto = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

const normalizarErrorGoogleDrive = (error) => {
  const message = error?.message || '';
  if (message.includes('Service Accounts do not have storage quota')) {
    return new Error(
      'La carpeta configurada debe estar dentro de una unidad compartida de Google Drive y la cuenta de servicio debe tener permiso de Administrador de contenido.',
    );
  }
  return error;
};

// Jerarquía de carpetas dentro de GOOGLE_DRIVE_FOLDER (la carpeta raíz,
// compartida entre todos los módulos que suben evidencias):
//   GOOGLE_DRIVE_FOLDER / <carpeta del módulo> / <subcarpeta por evidencia> / archivos
// Cada módulo que suba evidencias agrega su propia entrada a MODULOS_ID
// (cacheada en memoria tras la primera búsqueda/creación, igual que la
// conexión a `drive`).
const MODULOS_ID = {};

async function obtenerOCrearCarpeta(nombre, carpetaPadreId) {
  const drive = getDrive();
  const nombreEscapado = nombre.replace(/'/g, "\\'");
  const query = `name='${nombreEscapado}' and '${carpetaPadreId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const busqueda = await drive.files.list({ q: query, fields: 'files(id)', ...SHARED_DRIVE_OPTIONS });

  if (busqueda.data.files.length > 0) return busqueda.data.files[0].id;

  const nuevaCarpeta = await drive.files.create({
    resource: { name: nombre, mimeType: 'application/vnd.google-apps.folder', parents: [carpetaPadreId] },
    fields: 'id',
    supportsAllDrives: true,
  });
  return nuevaCarpeta.data.id;
}

// Resuelve (y cachea) el id de la carpeta de un módulo dentro de la raíz
// GOOGLE_DRIVE_FOLDER, creándola la primera vez que se necesita.
async function obtenerCarpetaModulo(nombreModulo) {
  if (MODULOS_ID[nombreModulo]) return MODULOS_ID[nombreModulo];

  const carpetaRaizId = process.env.GOOGLE_DRIVE_FOLDER;
  if (!carpetaRaizId) throw new Error('Falta GOOGLE_DRIVE_FOLDER en el entorno');

  const id = await obtenerOCrearCarpeta(nombreModulo, carpetaRaizId);
  MODULOS_ID[nombreModulo] = id;
  return id;
}

const MODULO_LABORES = 'Evaluacion_Labores';

// Sube las fotos de UNA visita de Evaluación de Labores. Jerarquía en Drive:
// GOOGLE_DRIVE_FOLDER / Evaluacion_Labores / {semana}_{finca}_{fecha}_VisitaSanidadVegetal / archivos
// La subcarpeta se reutiliza si ya existe (ej. si se suben fotos en más de
// un envío para la misma visita); el nombre identifica la evidencia por
// semana, finca, fecha y el formato de origen (mismo criterio pedido para
// que cualquier carpeta/archivo se identifique por sí solo sin tener que
// abrirlo).
export async function cargarFotosLaborCultural({ fincaNombre, semanaCodigo, fecha }, archivos) {
  if (!archivos?.length) throw new Error('No hay fotos para subir');

  const drive = getDrive();
  const identificador = [
    normalizarTexto(semanaCodigo) || 'sin_semana',
    normalizarTexto(fincaNombre) || 'sin_finca',
    fecha || 'sin_fecha',
    'VisitaSanidadVegetal',
  ].join('_');

  try {
    const carpetaModuloId = await obtenerCarpetaModulo(MODULO_LABORES);
    const subcarpetaId = await obtenerOCrearCarpeta(identificador, carpetaModuloId);

    const fotosSubidas = [];
    let contador = 1;
    for (const foto of archivos) {
      if (!foto.buffer?.length) continue;

      const extension = path.extname(foto.originalname || '').toLowerCase() || '.jpg';
      const nombreArchivo = `${identificador}_${contador}${extension}`;

      const archivoSubido = await drive.files.create({
        resource: { name: nombreArchivo, parents: [subcarpetaId] },
        media: { mimeType: foto.mimetype || 'image/jpeg', body: Readable.from(foto.buffer) },
        fields: 'id, webViewLink',
        supportsAllDrives: true,
      });

      fotosSubidas.push({
        idDrive: archivoSubido.data.id,
        urlDrive: archivoSubido.data.webViewLink,
        nombreOriginal: foto.originalname,
        nombreDrive: nombreArchivo,
      });
      contador += 1;
    }

    // Antes esto devolvía éxito con `fotos: []` si ningún archivo recibido
    // tenía contenido (ej. el picker de la app móvil mandó una referencia a
    // un archivo local que ya no existía) — el cliente lo tomaba como
    // subida exitosa y borraba el pendiente sin haber subido nada. Ahora se
    // lanza un error real para que quede visible y reintentable.
    if (fotosSubidas.length === 0) {
      throw new Error('Ninguna de las fotos recibidas tenía contenido válido');
    }

    return { carpetaId: subcarpetaId, carpetaUrl: `https://drive.google.com/drive/folders/${subcarpetaId}`, fotos: fotosSubidas };
  } catch (error) {
    logger.error('Error al subir fotos de labor cultural a Google Drive', { message: error.message });
    throw normalizarErrorGoogleDrive(error);
  }
}

export async function eliminarFotoDeDrive(fileId) {
  try {
    await getDrive().files.delete({ fileId, supportsAllDrives: true });
    return true;
  } catch (error) {
    logger.error(`Error al eliminar archivo ${fileId} de Google Drive`, { message: error.message });
    return false;
  }
}

// Descarga el contenido de un archivo (foto) de Drive para mostrarlo en el
// panel/PDF — un <img> no puede mandar el Authorization Bearer del panel, así
// que el frontend pide esto vía fetch autenticado y arma un blob local en
// vez de apuntar directo a Drive (que además exige que el archivo sea
// público, algo que no queremos en una unidad compartida privada).
export async function descargarArchivoDeDrive(fileId) {
  const drive = getDrive();
  const metadata = await drive.files.get({
    fileId,
    fields: 'mimeType, name',
    supportsAllDrives: true,
  });
  const contenido = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'stream' },
  );
  return { stream: contenido.data, mimeType: metadata.data.mimeType, nombre: metadata.data.name };
}

export default { cargarFotosLaborCultural, eliminarFotoDeDrive, descargarArchivoDeDrive };
