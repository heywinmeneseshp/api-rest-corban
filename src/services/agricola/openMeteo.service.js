import { Op, fn, col } from 'sequelize';
import { Finca, OpenMeteoClimaDiaria } from '../../database/associations.js';
import { openMeteoClient } from './openMeteo.client.js';
import { configuracionService } from '../sistema/configuracion.service.js';
import { getFincaIdsPermitidas } from '../../utils/fincaScope.js';
import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../../utils/logger.js';

const ZONA = 'America/Bogota';
const DIAS_POR_DEFECTO = 30; // cada actualización trae los últimos 30 días
// El archivo histórico (ERA5) tiene unos días de retraso; los últimos días se
// piden al endpoint de pronóstico (que no tiene datos útiles más atrás de eso).
const DIAS_RECIENTES = 8;
const PAUSA_ENTRE_FINCAS_MS = 1000;
const DIAS_FRECUENCIA = { DIARIA: 1, SEMANAL: 7, MENSUAL: 30 };

const CACHE_ACTUALES_MS = 5 * 60 * 1000;
let cacheActuales = null; // { clave, ts, data }

const dormir = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const r2 = (n) => (n === null || n === undefined || Number.isNaN(Number(n)) ? null : Math.round(Number(n) * 100) / 100);

const hoyIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const sumarDias = (iso, dias) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

// Open-Meteo limita las llamadas por minuto (una carga de todo el año para
// muchas fincas puede toparlo): ante ese error espera y reintenta.
async function conReintento(fn) {
  for (let intento = 0; ; intento++) {
    try {
      return await fn();
    } catch (error) {
      if (intento < 2 && /limit exceeded/i.test(error.message)) {
        await dormir(65000);
        continue;
      }
      throw error;
    }
  }
}

// Trae un rango combinando el endpoint reciente y el de archivo según la
// antigüedad de cada tramo.
async function traerRango(finca, fechaDesde, fechaHasta) {
  const args = { latitud: Number(finca.latitud), longitud: Number(finca.longitud) };
  const limiteReciente = sumarDias(hoyIso(), -DIAS_RECIENTES);
  const filas = [];
  if (fechaDesde < limiteReciente) {
    const finArchivo = fechaHasta < limiteReciente ? fechaHasta : sumarDias(limiteReciente, -1);
    filas.push(...(await openMeteoClient.archivo({ ...args, fechaDesde, fechaHasta: finArchivo })));
  }
  if (fechaHasta >= limiteReciente) {
    const inicio = fechaDesde < limiteReciente ? limiteReciente : fechaDesde;
    filas.push(...(await openMeteoClient.reciente({ ...args, fechaDesde: inicio, fechaHasta })));
  }
  return filas;
}

export const openMeteoService = {
  // Fincas operativas con coordenadas guardadas (Maestros > Fincas).
  async fincasConCoordenadas(user) {
    const permitidas = user ? getFincaIdsPermitidas(user) : null;
    const where = { estado: true, esExterna: false };
    if (permitidas) where.id = { [Op.in]: permitidas };
    const fincas = await Finca.findAll({ where, attributes: ['id', 'uuid', 'codigo', 'nombre', 'latitud', 'longitud'], order: [['nombre', 'ASC']] });
    return fincas.map((f) => ({
      uuid: f.uuid,
      codigo: f.codigo,
      nombre: f.nombre,
      latitud: f.latitud !== null ? Number(f.latitud) : null,
      longitud: f.longitud !== null ? Number(f.longitud) : null,
      conCoordenadas: f.latitud !== null && f.longitud !== null,
    }));
  },

  // Actualiza (upsert) el clima diario de las fincas con coordenadas. Por
  // defecto los últimos 30 días; `fincaUuids` opcional limita a esas fincas.
  async actualizar({ fechaDesde, fechaHasta, fincaUuids } = {}, actorId = null) {
    const hasta = fechaHasta || hoyIso();
    const desde = fechaDesde || sumarDias(hasta, -(DIAS_POR_DEFECTO - 1));
    if (desde > hasta) throw ApiError.badRequest('La fecha desde no puede ser mayor que la fecha hasta');

    const where = { estado: true, esExterna: false, latitud: { [Op.ne]: null }, longitud: { [Op.ne]: null } };
    if (fincaUuids?.length) where.uuid = { [Op.in]: fincaUuids };
    const fincas = await Finca.findAll({ where, order: [['nombre', 'ASC']] });

    const resultado = { desde, hasta, fincas: [], errores: [] };
    for (let i = 0; i < fincas.length; i++) {
      const finca = fincas[i];
      try {
        const filas = await conReintento(() => traerRango(finca, desde, hasta));
        let guardados = 0;
        for (const f of filas) {
          const datos = {
            mm: r2(f.mm),
            temperatura: r2(f.temperatura),
            temperaturaMaxima: r2(f.temperaturaMaxima),
            temperaturaMinima: r2(f.temperaturaMinima),
            humedadRelativa: r2(f.humedadRelativa),
            vientoVelocidad: r2(f.vientoVelocidad),
            vientoMax: r2(f.vientoMax),
            radiacion: r2(f.radiacion),
            et0: r2(f.et0),
          };
          if (Object.values(datos).every((v) => v === null)) continue;
          datos.celdaLatitud = f.celdaLatitud ?? null;
          datos.celdaLongitud = f.celdaLongitud ?? null;
          const existente = await OpenMeteoClimaDiaria.findOne({ where: { fincaId: finca.id, fecha: f.fecha } });
          if (existente) await existente.update(datos);
          else await OpenMeteoClimaDiaria.create({ fincaId: finca.id, fecha: f.fecha, ...datos });
          guardados += 1;
        }
        resultado.fincas.push({ uuid: finca.uuid, nombre: finca.nombre, dias: guardados });
      } catch (error) {
        logger.warn('Open-Meteo: falló la actualización de una finca', { finca: finca.nombre, message: error.message });
        resultado.errores.push({ finca: finca.nombre, error: error.message });
      }
      if (i < fincas.length - 1) await dormir(PAUSA_ENTRE_FINCAS_MS);
    }

    // Solo la actualización completa (sin filtro de fincas) cuenta como "última
    // actualización" para el scheduler.
    if (!fincaUuids?.length) {
      await configuracionService.setOpenMeteoConfig({ ultimaActualizacion: new Date().toISOString() }, actorId);
    }
    return resultado;
  },

  // Rellena los días del último mes (hasta ayer) que todavía no tienen dato
  // en alguna finca con coordenadas — mismo comportamiento que la Estación:
  // se llama al abrir el módulo, no por cron. Por finca pide un solo rango
  // (del primer al último día faltante).
  async actualizarFaltantes(user) {
    const ayer = sumarDias(hoyIso(), -1);
    // Desde el 1 de enero: la lluvia del mes y del año se suma de lo guardado.
    const desde = `${ayer.slice(0, 4)}-01-01`;
    const permitidas = user ? getFincaIdsPermitidas(user) : null;
    const where = { estado: true, esExterna: false, latitud: { [Op.ne]: null }, longitud: { [Op.ne]: null } };
    if (permitidas) where.id = { [Op.in]: permitidas };
    const fincas = await Finca.findAll({ where });
    if (!fincas.length) return { fincas: [], errores: [] };

    const registrados = await OpenMeteoClimaDiaria.findAll({
      where: { fincaId: { [Op.in]: fincas.map((f) => f.id) }, fecha: { [Op.between]: [desde, ayer] } },
      attributes: ['fincaId', 'fecha'],
    });
    const porFinca = new Map();
    for (const r of registrados) {
      const iso = r.fecha instanceof Date ? r.fecha.toISOString().slice(0, 10) : String(r.fecha);
      if (!porFinca.has(r.fincaId)) porFinca.set(r.fincaId, new Set());
      porFinca.get(r.fincaId).add(iso);
    }

    const resultado = { fincas: [], errores: [] };
    for (const finca of fincas) {
      const tiene = porFinca.get(finca.id) || new Set();
      const faltantes = [];
      for (let d = desde; d <= ayer; d = sumarDias(d, 1)) if (!tiene.has(d)) faltantes.push(d);
      if (!faltantes.length) continue;
      const r = await this.actualizar({ fechaDesde: faltantes[0], fechaHasta: faltantes[faltantes.length - 1], fincaUuids: [finca.uuid] });
      resultado.fincas.push(...r.fincas);
      resultado.errores.push(...r.errores);
    }
    return resultado;
  },

  // Condiciones actuales por finca (temperatura, humedad, viento y lluvia hoy /
  // última hora / mes / año), calculadas con Open-Meteo: lo "de ahora" viene
  // de la API (una sola llamada para todas las fincas, con caché de 5 min) y
  // la lluvia del mes y del año suma lo guardado hasta ayer más la de hoy.
  async actuales(user) {
    const permitidas = user ? getFincaIdsPermitidas(user) : null;
    const where = { estado: true, esExterna: false, latitud: { [Op.ne]: null }, longitud: { [Op.ne]: null } };
    if (permitidas) where.id = { [Op.in]: permitidas };
    const fincas = await Finca.findAll({ where, order: [['codigo', 'ASC']] });
    if (!fincas.length) return [];

    const clave = fincas.map((f) => `${f.id}:${f.latitud},${f.longitud}`).join('|');
    let vivos;
    if (cacheActuales && cacheActuales.clave === clave && Date.now() - cacheActuales.ts < CACHE_ACTUALES_MS) {
      vivos = cacheActuales.data;
    } else {
      vivos = [];
      for (let i = 0; i < fincas.length; i += 50) {
        const lote = fincas.slice(i, i + 50).map((f) => ({ latitud: Number(f.latitud), longitud: Number(f.longitud) }));
        vivos.push(...(await openMeteoClient.actuales(lote)));
      }
      cacheActuales = { clave, ts: Date.now(), data: vivos };
    }

    const hoy = hoyIso();
    const inicioAnio = `${hoy.slice(0, 4)}-01-01`;
    const inicioMes = `${hoy.slice(0, 7)}-01`;
    const ayer = sumarDias(hoy, -1);
    const sumar = async (desde) => {
      if (desde > ayer) return new Map();
      const rows = await OpenMeteoClimaDiaria.findAll({
        attributes: ['fincaId', [fn('SUM', col('mm')), 'total']],
        where: { fincaId: { [Op.in]: fincas.map((f) => f.id) }, fecha: { [Op.between]: [desde, ayer] } },
        group: ['fincaId'],
        raw: true,
      });
      return new Map(rows.map((r) => [r.fincaId, Number(r.total) || 0]));
    };
    const [anio, mes] = await Promise.all([sumar(inicioAnio), sumar(inicioMes)]);

    return fincas.map((f, i) => {
      const v = vivos[i] || {};
      const hoyMm = v.lluviaHoyMm ?? 0;
      return {
        uuid: f.uuid,
        codigo: f.codigo,
        nombre: f.nombre,
        medidoEn: v.medidoEn ?? null,
        temperatura: v.temperatura ?? null,
        humedadRelativa: v.humedadRelativa ?? null,
        vientoKmh: v.vientoKmh ?? null,
        lluviaHoyMm: v.lluviaHoyMm ?? null,
        lluviaUltimaHoraMm: v.lluviaUltimaHoraMm !== null && v.lluviaUltimaHoraMm !== undefined ? r2(v.lluviaUltimaHoraMm) : null,
        lluviaMesMm: r2((mes.get(f.id) || 0) + hoyMm),
        lluviaAnioMm: r2((anio.get(f.id) || 0) + hoyMm),
        celda: v.celdaLatitud !== null && v.celdaLatitud !== undefined ? `${Number(v.celdaLatitud).toFixed(2)},${Number(v.celdaLongitud).toFixed(2)}` : null,
      };
    });
  },

  // Clima guardado, con el nombre de la finca. Respeta las fincas permitidas
  // del usuario.
  async listar({ fincaUuids, fechaDesde, fechaHasta } = {}, user) {
    const permitidas = getFincaIdsPermitidas(user);
    const whereFinca = {};
    if (fincaUuids?.length) whereFinca.uuid = { [Op.in]: fincaUuids };
    if (permitidas) whereFinca.id = { [Op.in]: permitidas };

    const where = {};
    if (fechaDesde || fechaHasta) {
      where.fecha = {};
      if (fechaDesde) where.fecha[Op.gte] = fechaDesde;
      if (fechaHasta) where.fecha[Op.lte] = fechaHasta;
    }
    const rows = await OpenMeteoClimaDiaria.findAll({
      where,
      include: [{ model: Finca, as: 'finca', where: whereFinca, attributes: ['uuid', 'codigo', 'nombre'] }],
      order: [['fecha', 'DESC'], [{ model: Finca, as: 'finca' }, 'nombre', 'ASC']],
      limit: 2000,
    });
    return rows.map((r) => ({
      uuid: r.uuid,
      fecha: r.fecha,
      finca: { uuid: r.finca.uuid, codigo: r.finca.codigo, nombre: r.finca.nombre },
      mm: r.mm,
      temperatura: r.temperatura,
      temperaturaMaxima: r.temperaturaMaxima,
      temperaturaMinima: r.temperaturaMinima,
      humedadRelativa: r.humedadRelativa,
      vientoVelocidad: r.vientoVelocidad,
      vientoMax: r.vientoMax,
      radiacion: r.radiacion,
      et0: r.et0,
      // Punto de malla del dato (2 decimales): la misma clave = mismo valor.
      celda: r.celdaLatitud !== null && r.celdaLongitud !== null ? `${Number(r.celdaLatitud).toFixed(2)},${Number(r.celdaLongitud).toFixed(2)}` : null,
    }));
  },

  // ¿Toca actualizar según la frecuencia configurada? (lo usa el job diario)
  async debeActualizar() {
    const { frecuencia, ultimaActualizacion } = await configuracionService.getOpenMeteoConfig();
    if (!ultimaActualizacion) return true;
    const ultimaFecha = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ultimaActualizacion));
    const dias = Math.round((new Date(`${hoyIso()}T12:00:00Z`) - new Date(`${ultimaFecha}T12:00:00Z`)) / 86400000);
    return dias >= (DIAS_FRECUENCIA[frecuencia] || 1);
  },

  async actualizarSiCorresponde() {
    if (!(await this.debeActualizar())) return { actualizado: false };
    const resultado = await this.actualizar({});
    return { actualizado: true, ...resultado };
  },
};

export default openMeteoService;
