import { Op } from 'sequelize';
import { Equipo, ProgramacionMantenimiento, PlanMantenimiento, User } from '../../database/associations.js';
import { logger } from '../../utils/logger.js';
import { resolverDestinatarios } from '../../utils/resolverDestinatarios.js';
import { configuracionService } from '../sistema/configuracion.service.js';
import { mailService } from '../sistema/mail.service.js';

const hoyBogota = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
const sumarDias = (iso, d) => {
  const f = new Date(`${iso}T12:00:00Z`);
  f.setUTCDate(f.getUTCDate() + d);
  return f.toISOString().slice(0, 10);
};

// Responsable (recibe el aviso aparte de las personas en copia): el de la programación o, si no tiene, el del equipo.
export async function correoResponsable(responsableId, equipoId) {
  const id = responsableId || (equipoId ? (await Equipo.findByPk(equipoId, { attributes: ['responsableId'] }))?.responsableId : null);
  if (!id) return null;
  const u = await User.findByPk(id, { attributes: ['email', 'estado'] });
  return u?.estado !== false && u?.email ? u.email : null;
}

// Correos a avisar: el responsable (si está activado en la tuerca) más las personas en copia configuradas.
export async function destinatariosAviso(config, { responsableId, equipoId }) {
  const copia = new Set((await resolverDestinatarios(config)).map((p) => p.email));
  if (!config.avisarResponsable) return [...copia];
  const r = await correoResponsable(responsableId, equipoId);
  if (!r) return [...copia];
  copia.delete(r);
  return [r, ...copia];
}

export const mantenimientoAvisosService = {
  // Programaciones abiertas que vencen en los próximos `diasAnticipacion` días (o ya vencieron): un correo por estado (PROXIMO y luego VENCIDO).
  async avisarProgramaciones() {
    const config = await configuracionService.getMantenimientoDestinatarios();
    const hoy = hoyBogota();
    const limite = sumarDias(hoy, config.diasAnticipacion);
    const programaciones = await ProgramacionMantenimiento.findAll({
      where: { estado: { [Op.in]: ['PENDIENTE', 'PROGRAMADA'] }, fechaProgramada: { [Op.lte]: limite } },
      include: [
        { model: Equipo, as: 'equipo', attributes: ['codigo', 'nombre'] },
        { model: PlanMantenimiento, as: 'plan', attributes: ['nombre'] },
      ],
    });
    let enviados = 0;
    for (const p of programaciones) {
      const estado = p.fechaProgramada < hoy ? 'VENCIDO' : 'PROXIMO';
      if (p.avisoEstado === 'VENCIDO' || p.avisoEstado === estado) continue;
      try {
        const destinatarios = await destinatariosAviso(config, { responsableId: p.responsableId, equipoId: p.equipoId });
        if (destinatarios.length === 0) {
          logger.warn('Mantenimiento programado próximo o vencido, pero no hay a quién avisar', { programacion: p.uuid });
          continue;
        }
        const dias = Math.round((new Date(`${p.fechaProgramada}T12:00:00Z`) - new Date(`${hoy}T12:00:00Z`)) / 86400000);
        await mailService.sendMantenimientoProgramado({ destinatarios, equipo: p.equipo, plan: p.plan?.nombre || 'Mantenimiento', fecha: p.fechaProgramada, estado, dias });
        await p.update({ avisoEstado: estado });
        enviados += 1;
      } catch (err) {
        logger.error('No se pudo enviar el aviso de mantenimiento programado', { message: err.message, programacion: p.uuid });
      }
    }
    return { revisadas: programaciones.length, enviados };
  },
};

export default mantenimientoAvisosService;
