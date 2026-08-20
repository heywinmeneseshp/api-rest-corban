import { backupService, FRASE_CONFIRMACION_IMPORT } from '../../services/sistema/backup.service.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const backupController = {
  exportar: asyncHandler(async (req, res) => {
    const proceso = backupService.iniciarExport();
    const fecha = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

    res.setHeader('Content-Type', 'application/sql');
    res.setHeader('Content-Disposition', `attachment; filename="corbana_backup_${fecha}.sql"`);

    let huboError = false;
    proceso.on('error', () => {
      huboError = true;
      if (!res.headersSent) res.status(500);
      res.end();
    });
    proceso.on('close', (code) => {
      if (code !== 0 && !huboError && !res.writableEnded) {
        res.end();
      }
    });
    proceso.stdout.pipe(res);
  }),

  importar: asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('Debes adjuntar el archivo .sql a importar');
    if (req.body.confirmacion !== FRASE_CONFIRMACION_IMPORT) {
      throw ApiError.badRequest(`Debes escribir exactamente "${FRASE_CONFIRMACION_IMPORT}" para confirmar`);
    }

    await backupService.importarDump(req.file.buffer, req.user?.id);
    ApiResponse.send(res, { message: 'Base de datos importada (reemplazada) correctamente' });
  }),
};

export default backupController;
