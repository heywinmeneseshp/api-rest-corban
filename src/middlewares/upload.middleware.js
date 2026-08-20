import multer from 'multer';

const ALLOWED_MIME = [
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
];

const storage = multer.memoryStorage();

export const uploadBulkFile = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isAllowedExt = /\.(csv|xlsx|xls)$/i.test(file.originalname);
    if (isAllowedExt || ALLOWED_MIME.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(Object.assign(new Error('Formato de archivo no soportado. Usa .csv o .xlsx'), { statusCode: 400 }));
    }
  },
}).single('file');

// Fotos de la Evaluación de Labores (visita completa) — memoryStorage
// porque se suben directo a Google Drive (ver services/googleDrive/), mismo
// criterio que api-rest-banarica: nunca tocan el disco del servidor.
const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export const uploadFotosLabor = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_MIME.includes(file.mimetype)) cb(null, true);
    else cb(Object.assign(new Error('Formato de imagen no soportado. Usa JPG, PNG, WEBP o HEIC'), { statusCode: 400 }));
  },
}).array('fotos', 10);

// Dump completo de la base de datos a importar (Configuración → Base de
// datos) — puede pesar bastante más que un cargue masivo normal, de ahí el
// límite propio y más generoso.
export const uploadSqlDump = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 300 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isSql = /\.sql$/i.test(file.originalname);
    if (isSql) cb(null, true);
    else cb(Object.assign(new Error('Formato de archivo no soportado. Usa un .sql'), { statusCode: 400 }));
  },
}).single('file');

export default uploadBulkFile;
