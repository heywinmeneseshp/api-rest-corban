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

export default uploadBulkFile;
