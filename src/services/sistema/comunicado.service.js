import { comunicadoRepository } from '../../repositories/sistema/comunicado.repository.js';
import { Role, User } from '../../database/associations.js';
import { resolverDestinatarios } from '../../utils/resolverDestinatarios.js';
import { mailService } from './mail.service.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';

export const comunicadoService = {
  async list(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await comunicadoRepository.findAndCountAll({
      limit,
      offset,
      search: query.search,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getByUuid(uuid) {
    const comunicado = await comunicadoRepository.findByUuid(uuid);
    if (!comunicado) throw ApiError.notFound('Comunicado no encontrado');
    return comunicado;
  },

  // Envía el comunicado a todos los destinatarios resueltos (correos +
  // roles + usuarios puntuales, deduplicados por email) y guarda un
  // registro en el historial con el resultado por destinatario — un correo
  // fallido no bloquea a los demás (mismo criterio que bulkResetPassword).
  // `archivos`: arreglo de archivos de multer (req.files) — { originalname,
  // mimetype, size, buffer } — opcional, nunca se guarda el binario, solo
  // pasa en memoria a mailService y se registra la metadata en el historial.
  async enviar(payload, actorId, archivos = []) {
    const { asunto, mensaje, correos = [], rolesUuids = [], usuariosUuids = [] } = payload;

    const destinatarios = await resolverDestinatarios({ correos, rolesUuids, usuariosUuids });
    if (destinatarios.length === 0) {
      throw ApiError.badRequest('No se pudo resolver ningún destinatario real (correos/roles/usuarios) — revisa la selección');
    }

    const attachments = archivos.map((f) => ({ filename: f.originalname, content: f.buffer, contentType: f.mimetype }));
    const adjuntosResumen = archivos.map((f) => ({ nombre: f.originalname, tamanioBytes: f.size, tipo: f.mimetype }));

    // Snapshot de nombres para el historial (roles/usuarios elegidos),
    // independiente de los emails ya resueltos arriba.
    const [rolesInfo, usuariosInfo] = await Promise.all([
      rolesUuids.length ? Role.findAll({ where: { uuid: rolesUuids }, attributes: ['uuid', 'nombre'] }) : [],
      usuariosUuids.length
        ? User.findAll({ where: { uuid: usuariosUuids }, attributes: ['uuid', 'usuario', 'nombre', 'apellido'] })
        : [],
    ]);
    const destinatariosResumen = {
      correos,
      roles: rolesInfo.map((r) => ({ uuid: r.uuid, nombre: r.nombre })),
      usuarios: usuariosInfo.map((u) => ({ uuid: u.uuid, usuario: u.usuario, nombre: `${u.nombre} ${u.apellido}`.trim() })),
    };

    const resultados = [];
    for (const destinatario of destinatarios) {
      try {
        await mailService.sendComunicado(destinatario, { asunto, mensaje, attachments });
        resultados.push({ email: destinatario.email, nombre: destinatario.nombre, ok: true });
      } catch (err) {
        resultados.push({ email: destinatario.email, nombre: destinatario.nombre, ok: false, error: err.message });
      }
    }

    const enviadosOk = resultados.filter((r) => r.ok).length;
    const enviadosError = resultados.length - enviadosOk;

    const comunicado = await comunicadoRepository.create({
      asunto,
      mensaje,
      destinatariosResumen,
      resultados,
      adjuntos: adjuntosResumen,
      totalDestinatarios: resultados.length,
      enviadosOk,
      enviadosError,
      createdBy: actorId,
    });

    return comunicadoRepository.findByUuid(comunicado.uuid);
  },
};

export default comunicadoService;
