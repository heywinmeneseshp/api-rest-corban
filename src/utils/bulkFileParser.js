import * as XLSX from 'xlsx';
import { ApiError } from './ApiError.js';

// Convierte un archivo .csv/.xlsx (buffer en memoria, vía multer) en un
// arreglo de objetos {columna: valor}, usando la primera fila como
// encabezados. Los nombres de columna se normalizan (minúsculas, sin
// espacios/acentos) para que el resto del código no dependa de cómo el
// usuario haya escrito los encabezados en su archivo.
export function parseBulkFile(file) {
  if (!file) throw ApiError.badRequest('Debes adjuntar un archivo (.csv o .xlsx)');

  let workbook;
  try {
    workbook = XLSX.read(file.buffer, { type: 'buffer' });
  } catch {
    throw ApiError.badRequest('No se pudo leer el archivo. Verifica que sea un .csv o .xlsx válido');
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  return rows.map((row) => {
    const normalized = {};
    for (const [key, value] of Object.entries(row)) {
      const normalizedKey = key
        .toString()
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, '');
      normalized[normalizedKey] = typeof value === 'string' ? value.trim() : value;
    }
    return normalized;
  });
}

export default parseBulkFile;
