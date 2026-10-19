import { Op } from 'sequelize';
import { Semana } from '../../database/associations.js';
import { climaComparativaService } from './climaComparativa.service.js';
import { configuracionService } from '../sistema/configuracion.service.js';
import { ApiError } from '../../utils/ApiError.js';

// Unidades calóricas (UC) acumuladas por semana de embolse. UC diaria =
// (Tmáx + Tmín)/2 − base (igual que app-corbana/lib/climaAgregar.js; los
// negativos no se truncan). Edad N = N semanas contando la semana del embolse
// como edad 1; la acumulación parte del PRIMER día de esa semana (el día exacto
// del embolse no se guarda) y llega al último día de la semana N.
const DIA_MS = 86400000;
const sumarDias = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10);
const hoyBogota = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Bogota' });
const redondear = (n) => Math.round(n * 100) / 100;

export const ucEmbolseService = {
  // Fuentes de clima (estaciones + fincas con Open-Meteo) y bases de UC configuradas.
  async opciones(user) {
    const [fuentes, bases] = await Promise.all([climaComparativaService.fuentes(user), configuracionService.getEstacionUcBases()]);
    return { fuentes, bases };
  },

  async calcular({ fuente, baseUc, anio, semanaDesde, semanaHasta, edadMax = 12 }, user) {
    const bases = await configuracionService.getEstacionUcBases();
    if (!bases.includes(Number(baseUc))) throw ApiError.badRequest(`La base ${baseUc} no está configurada (bases: ${bases.join(', ')})`);

    const where = { anio: Number(anio) };
    if (semanaDesde || semanaHasta) {
      where.numeroSemana = { [Op.between]: [Number(semanaDesde) || 1, Number(semanaHasta) || 53] };
    }
    const semanas = await Semana.findAll({ where, order: [['numeroSemana', 'ASC']] });
    if (semanas.length === 0) return { base: Number(baseUc), fuente, edadMax, cohortes: [] };

    const hoy = hoyBogota();
    const desde = String(semanas[0].fechaInicio).slice(0, 10);
    const hasta = sumarDias(String(semanas[semanas.length - 1].fechaInicio).slice(0, 10), edadMax * 7 - 1);
    // Calendario de semanas que cubre las edades pedidas: la "semana de cosecha" de una edad N es la semana N-ésima desde el embolse
    // (la edad 1 es la semana del embolse).
    const calendario = await Semana.findAll({ where: { fechaInicio: { [Op.between]: [desde, hasta] } }, attributes: ['codigo', 'fechaInicio'], raw: true });
    const codigoPorInicio = new Map(calendario.map((c) => [String(c.fechaInicio).slice(0, 10), c.codigo]));
    const filas = await climaComparativaService.datos({ fuentes: [fuente], fechaDesde: desde, fechaHasta: hasta }, user);

    const ucPorDia = new Map();
    for (const f of filas) {
      if (f.temperaturaMaxima === null || f.temperaturaMaxima === undefined || f.temperaturaMinima === null || f.temperaturaMinima === undefined) continue;
      ucPorDia.set(f.fecha, (f.temperaturaMaxima + f.temperaturaMinima) / 2 - Number(baseUc));
    }

    const cohortes = semanas.map((s) => {
      const inicio = String(s.fechaInicio).slice(0, 10);
      const puntos = [];
      let acumulado = 0;
      for (let edad = 1; edad <= edadMax; edad += 1) {
        const ini = sumarDias(inicio, (edad - 1) * 7);
        if (ini > hoy) break;
        let dias = 0;
        let diasConDato = 0;
        for (let d = 0; d < 7; d += 1) {
          const dia = sumarDias(ini, d);
          if (dia > hoy) break;
          dias += 1;
          if (ucPorDia.has(dia)) {
            diasConDato += 1;
            acumulado += ucPorDia.get(dia);
          }
        }
        puntos.push({ edad, uc: redondear(acumulado), dias, diasConDato, completa: dias === 7, semanaCosecha: codigoPorInicio.get(ini) || null });
      }
      return {
        semana: { uuid: s.uuid, codigo: s.codigo, numeroSemana: s.numeroSemana, anio: s.anio, color: s.color },
        puntos,
      };
    });

    return { base: Number(baseUc), fuente, edadMax, cohortes };
  },
};

export default ucEmbolseService;
