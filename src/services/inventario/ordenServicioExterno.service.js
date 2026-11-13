import { sequelize } from '../../database/connection.js';
import { OrdenAdjunto, OrdenChecklistItem, OrdenHallazgo, OrdenMantenimiento, OrdenParticipante, Proveedor, Equipo } from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';
import { cargarAdjuntosMantenimiento, descargarArchivoDeDrive, eliminarFotoDeDrive } from '../googleDrive/cargueFotosLabor.js';

// Datos del servicio de una orden hecho por un tercero (proveedor, técnico responsable, fechas, quién recibió), los participantes (p. ej. colaboradores en
// entrenamiento) y los adjuntos (fotos, carta de autorización, informes) guardados en Google Drive. Se puede completar aunque la orden ya esté cerrada,
// porque la aceptación y las evidencias suelen llegar después.
const EJECUTORES = ['INTERNO', 'EXTERNO'];
const ROLES = ['ENTRENAMIENTO', 'ACOMPANANTE'];
const TIPOS_ADJUNTO = ['FOTO', 'CARTA_AUTORIZACION', 'INFORME'];
const num = (v) => (v === null || v === undefined ? null : Number(v));

async function buscarOrden(uuid, transaction) {
  const o = await OrdenMantenimiento.findOne({ where: { uuid }, transaction });
  if (!o) throw ApiError.notFound('Orden de mantenimiento no encontrada');
  return o;
}

const adjuntoPublico = (a, hallazgos = new Map(), items = new Map()) => ({
  uuid: a.uuid,
  tipo: a.tipo,
  nombre: a.nombreOriginal,
  mime: a.mime,
  urlDrive: a.urlDrive,
  hallazgoUuid: a.hallazgoId ? hallazgos.get(a.hallazgoId) ?? null : null,
  itemUuid: a.checklistItemId ? items.get(a.checklistItemId) ?? null : null,
  creadoEn: a.createdAt,
});

export const ordenServicioExternoService = {
  async obtener(ordenUuid) {
    const orden = await buscarOrden(ordenUuid);
    const [proveedor, participantes, adjuntos, hallazgos, items] = await Promise.all([
      orden.proveedorId ? Proveedor.findByPk(orden.proveedorId, { attributes: ['uuid', 'nombre'] }) : null,
      OrdenParticipante.findAll({ where: { ordenId: orden.id }, order: [['id', 'ASC']] }),
      OrdenAdjunto.findAll({ where: { ordenId: orden.id }, order: [['id', 'ASC']] }),
      OrdenHallazgo.findAll({ where: { ordenId: orden.id }, attributes: ['id', 'uuid'], raw: true }),
      OrdenChecklistItem.findAll({ where: { ordenId: orden.id }, attributes: ['id', 'uuid'], raw: true }),
    ]);
    const hMap = new Map(hallazgos.map((h) => [h.id, h.uuid]));
    const iMap = new Map(items.map((i) => [i.id, i.uuid]));
    return {
      ejecutorTipo: orden.ejecutorTipo,
      proveedor: proveedor ? { uuid: proveedor.uuid, nombre: proveedor.nombre } : null,
      tecnicoResponsable: orden.tecnicoResponsable,
      fechaInicio: orden.fechaInicio,
      lecturaKm: num(orden.lecturaKm),
      lecturaHoras: num(orden.lecturaHoras),
      recibidoPor: orden.recibidoPor,
      fechaAceptacion: orden.fechaAceptacion,
      participantes: participantes.map((p) => ({ nombre: p.nombre, rol: p.rol })),
      adjuntos: adjuntos.map((a) => adjuntoPublico(a, hMap, iMap)),
    };
  },

  async guardar(ordenUuid, datos) {
    await sequelize.transaction(async (transaction) => {
      const orden = await buscarOrden(ordenUuid, transaction);
      const cambios = {};
      if (datos.ejecutorTipo !== undefined) {
        if (!EJECUTORES.includes(datos.ejecutorTipo)) throw ApiError.badRequest('Tipo de ejecutor inválido');
        cambios.ejecutorTipo = datos.ejecutorTipo;
      }
      if (datos.proveedorUuid !== undefined) {
        if (!datos.proveedorUuid) cambios.proveedorId = null;
        else {
          const p = await Proveedor.findOne({ where: { uuid: datos.proveedorUuid }, attributes: ['id'], transaction });
          if (!p) throw ApiError.notFound('Proveedor no encontrado');
          cambios.proveedorId = p.id;
        }
      }
      for (const campo of ['tecnicoResponsable', 'recibidoPor']) if (datos[campo] !== undefined) cambios[campo] = datos[campo] ? String(datos[campo]).trim() || null : null;
      for (const campo of ['fechaInicio', 'fechaAceptacion']) if (datos[campo] !== undefined) cambios[campo] = datos[campo] || null;
      for (const campo of ['lecturaKm', 'lecturaHoras']) if (datos[campo] !== undefined) cambios[campo] = datos[campo] === null || datos[campo] === '' ? null : Number(datos[campo]);
      if (Object.keys(cambios).length) await orden.update(cambios, { transaction });
      if (datos.participantes !== undefined) {
        await OrdenParticipante.destroy({ where: { ordenId: orden.id }, transaction });
        const filas = (datos.participantes || [])
          .map((p) => ({ ordenId: orden.id, nombre: String(p.nombre || '').trim(), rol: ROLES.includes(p.rol) ? p.rol : 'ENTRENAMIENTO' }))
          .filter((p) => p.nombre);
        if (filas.length) await OrdenParticipante.bulkCreate(filas, { transaction });
      }
    });
    return this.obtener(ordenUuid);
  },

  // Sube archivos a Drive y los registra. `hallazgoUuid` / `itemUuid` los ligan a un hallazgo o a un ítem del checklist.
  async agregarAdjuntos(ordenUuid, { tipo, hallazgoUuid, itemUuid }, archivos, user) {
    const orden = await buscarOrden(ordenUuid);
    if (!archivos?.length) throw ApiError.badRequest('Elige al menos un archivo');
    const tipoFinal = TIPOS_ADJUNTO.includes(tipo) ? tipo : 'FOTO';
    const hallazgo = hallazgoUuid ? await OrdenHallazgo.findOne({ where: { uuid: hallazgoUuid, ordenId: orden.id }, attributes: ['id'] }) : null;
    if (hallazgoUuid && !hallazgo) throw ApiError.notFound('Hallazgo no encontrado en esta orden');
    const item = itemUuid ? await OrdenChecklistItem.findOne({ where: { uuid: itemUuid, ordenId: orden.id }, attributes: ['id'] }) : null;
    if (itemUuid && !item) throw ApiError.notFound('Ítem de checklist no encontrado en esta orden');
    const equipo = await Equipo.findByPk(orden.equipoId, { attributes: ['codigo'] });
    let subidos;
    try {
      subidos = await cargarAdjuntosMantenimiento({ equipoCodigo: equipo?.codigo, ordenNumero: orden.numero }, archivos);
    } catch (err) {
      throw ApiError.badRequest(`No se pudieron subir los archivos a Google Drive: ${err.message}`);
    }
    await OrdenAdjunto.bulkCreate(
      subidos.archivos.map((a) => ({ ordenId: orden.id, hallazgoId: hallazgo?.id ?? null, checklistItemId: item?.id ?? null, tipo: tipoFinal, idDrive: a.idDrive, urlDrive: a.urlDrive, nombreOriginal: a.nombreOriginal, mime: a.mime, createdBy: user?.id ?? null })),
    );
    return { carpetaUrl: subidos.carpetaUrl, ...(await this.obtener(ordenUuid)) };
  },

  async descargarAdjunto(adjuntoUuid) {
    const a = await OrdenAdjunto.findOne({ where: { uuid: adjuntoUuid } });
    if (!a) throw ApiError.notFound('Adjunto no encontrado');
    return descargarArchivoDeDrive(a.idDrive);
  },

  async eliminarAdjunto(adjuntoUuid) {
    const a = await OrdenAdjunto.findOne({ where: { uuid: adjuntoUuid } });
    if (!a) throw ApiError.notFound('Adjunto no encontrado');
    await eliminarFotoDeDrive(a.idDrive);
    await a.destroy();
  },
};

export default ordenServicioExternoService;
