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

// Sube las fotos de UNA visita de Evaluación de Labores a una subcarpeta
// dentro de la carpeta principal (GOOGLE_DRIVE_FOLDER_LABORES). La
// subcarpeta se nombra por finca+semana+fecha y se reutiliza si ya existe
// (ej. si se suben fotos en más de un envío para la misma visita).
export async function cargarFotosLaborCultural({ fincaNombre, semanaCodigo, fecha, visitaUuid }, archivos) {
  const carpetaPrincipalId = process.env.GOOGLE_DRIVE_FOLDER_LABORES;
  if (!carpetaPrincipalId) throw new Error('Falta GOOGLE_DRIVE_FOLDER_LABORES en el entorno');
  if (!archivos?.length) throw new Error('No hay fotos para subir');

  const drive = getDrive();
  const nombreSubcarpeta = `${normalizarTexto(fincaNombre) || 'sin_finca'}_${normalizarTexto(semanaCodigo) || 'sin_semana'}_${fecha || 'sin_fecha'}`;

  try {
    let subcarpetaId;
    const queryBusqueda = `name='${nombreSubcarpeta}' and '${carpetaPrincipalId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const busqueda = await drive.files.list({ q: queryBusqueda, fields: 'files(id)', ...SHARED_DRIVE_OPTIONS });

    if (busqueda.data.files.length > 0) {
      subcarpetaId = busqueda.data.files[0].id;
    } else {
      const nuevaCarpeta = await drive.files.create({
        resource: { name: nombreSubcarpeta, mimeType: 'application/vnd.google-apps.folder', parents: [carpetaPrincipalId] },
        fields: 'id',
        supportsAllDrives: true,
      });
      subcarpetaId = nuevaCarpeta.data.id;
    }

    const fotosSubidas = [];
    let contador = 1;
    for (const foto of archivos) {
      if (!foto.buffer?.length) continue;

      const extension = path.extname(foto.originalname || '').toLowerCase() || '.jpg';
      const nombreArchivo = `${visitaUuid}_${contador}_${Date.now()}${extension}`;

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

    return { carpetaId: subcarpetaId, carpetaUrl: `https://drive.google.com/drive/folders/${subcarpetaId}`, fotos: fotosSubidas };
  } catch (error) {
    logger.error('Error al subir fotos de labor cultural a Google Drive', { message: error.message });
    throw normalizarErrorGoogleDrive(error);
  }
}

export async function eliminarFotoDeDrive(fileId) {
  try {
    await getDrive().files.delete({ fileId });
    return true;
  } catch (error) {
    logger.error(`Error al eliminar archivo ${fileId} de Google Drive`, { message: error.message });
    return false;
  }
}

export default { cargarFotosLaborCultural, eliminarFotoDeDrive };
