import { QueryTypes } from 'sequelize';
import { sequelize } from '../../database/connection.js';
import { getFincaIdsPermitidas } from '../../utils/fincaScope.js';
import { fracLimiteService } from './fracLimite.service.js';
import { logger } from '../../utils/logger.js';

// Resumen semanal (Reportes → Resumen semanal): reúne en una sola vista los avisos de varios módulos. Cada grupo se calcula por separado y
// si uno falla los demás se muestran igual (el error queda en el grupo). Severidad: 'alta' | 'media' | 'baja'.

const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: QueryTypes.SELECT, logging: false });
const hoyIso = () => new Date().toISOString().slice(0, 10);
const RATIO_MIN = 0.7;
const RATIO_MAX = 1.3;
const pct = (v) => `${v > 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;

async function semanaActual() {
  const [s] = await q('SELECT id, codigo, anio, numero_semana AS numeroSemana, fecha_inicio AS fechaInicio FROM semanas WHERE fecha_inicio <= CURDATE() AND fecha_fin >= CURDATE() AND deleted_at IS NULL LIMIT 1');
  return s || null;
}

// Fincas propias (no externas) que el usuario puede ver.
async function fincasPropias(user) {
  const permitidas = getFincaIdsPermitidas(user);
  return q(
    `SELECT id, uuid, codigo, nombre FROM fincas WHERE deleted_at IS NULL AND estado = 1 AND es_externa = 0 ${permitidas ? 'AND id IN (:ids)' : ''} ORDER BY nombre`,
    { ids: permitidas && permitidas.length ? permitidas : [0] },
  );
}

// Ratio (cajas ÷ racimos cosechados) de la última semana cerrada frente al promedio de esa misma semana en años anteriores, por finca y
// en total. También avisa si viene bajando tres semanas seguidas.
async function alertasRatio(fincas, actual) {
  if (!actual || fincas.length === 0) return [];
  const ids = fincas.map((f) => f.id);
  const semanas = await q(
    `SELECT id, codigo, anio, numero_semana AS n, fecha_inicio AS f FROM semanas
      WHERE deleted_at IS NULL AND fecha_inicio < :inicio AND fecha_inicio >= DATE_SUB(:inicio, INTERVAL 4 YEAR) ORDER BY fecha_inicio`,
    { inicio: actual.fechaInicio },
  );
  if (semanas.length === 0) return [];
  const semIds = semanas.map((s) => s.id);
  const [rac, caj] = await Promise.all([
    q(
      `SELECT finca_id AS fincaId, semana_registro_id AS semanaId, SUM(cantidad) AS v FROM racimo_movimientos
        WHERE deleted_at IS NULL AND tipo IN ('PROCESADO','RECUSE') AND finca_id IN (:ids) AND semana_registro_id IN (:semIds)
        GROUP BY finca_id, semana_registro_id`,
      { ids, semIds },
    ),
    q(
      `SELECT finca_id AS fincaId, semana_id AS semanaId, SUM(cajas_20kg) AS v FROM produccion_semanal
        WHERE deleted_at IS NULL AND finca_id IN (:ids) AND semana_id IN (:semIds) GROUP BY finca_id, semana_id`,
      { ids, semIds },
    ),
  ]);
  const R = new Map(rac.map((r) => [`${r.fincaId}-${r.semanaId}`, Number(r.v)]));
  const C = new Map(caj.map((r) => [`${r.fincaId}-${r.semanaId}`, Number(r.v)]));
  // Ratio cruzado: solo fincas con cajas Y racimos esa semana.
  const ratio = (fincaIds, semanaId) => {
    let r = 0;
    let c = 0;
    for (const fid of fincaIds) {
      const rf = R.get(`${fid}-${semanaId}`) || 0;
      const cf = C.get(`${fid}-${semanaId}`) || 0;
      if (rf > 0 && cf > 0) {
        r += rf;
        c += cf;
      }
    }
    const v = r > 0 ? c / r : null;
    return v !== null && v >= RATIO_MIN && v <= RATIO_MAX ? v : null;
  };
  const historico = (fincaIds, sem) => {
    const vals = semanas
      .filter((s) => s.anio < sem.anio && Math.min(Math.abs(s.n - sem.n), 52 - Math.abs(s.n - sem.n)) <= 1)
      .map((s) => ratio(fincaIds, s.id))
      .filter((v) => v !== null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };

  const alertas = [];
  const evaluar = (nombre, fincaIds, enlace) => {
    // Última semana con ratio (la en curso no cuenta: está incompleta).
    const conDato = [];
    for (let i = semanas.length - 1; i >= 0 && conDato.length < 4; i--) {
      const v = ratio(fincaIds, semanas[i].id);
      if (v !== null) conDato.push({ sem: semanas[i], v });
    }
    if (conDato.length === 0) return;
    const ult = conDato[0];
    const hist = historico(fincaIds, ult.sem);
    if (hist) {
      const dif = ult.v / hist - 1;
      if (dif <= -0.07) {
        alertas.push({
          severidad: dif <= -0.12 ? 'alta' : 'media',
          titulo: `${nombre}: ratio ${ult.v.toFixed(3)} en ${ult.sem.codigo}`,
          detalle: `${pct(dif)} frente al promedio histórico de esa semana (${hist.toFixed(3)}).`,
          enlace,
        });
        return;
      }
    }
    if (conDato.length >= 4 && conDato[0].v < conDato[1].v && conDato[1].v < conDato[2].v && conDato[2].v < conDato[3].v) {
      alertas.push({
        severidad: 'baja',
        titulo: `${nombre}: el ratio baja tres semanas seguidas`,
        detalle: `${conDato
          .slice()
          .reverse()
          .map((d) => `${d.sem.codigo} ${d.v.toFixed(3)}`)
          .join(' → ')}.`,
        enlace,
      });
    }
  };
  evaluar('Total de fincas', ids, '/reportes/ratio');
  for (const f of fincas) evaluar(f.nombre, [f.id], '/reportes/ratio');
  return alertas;
}

async function alertasStock() {
  const filas = await q(
    `SELECT a.uuid, a.codigo, a.nombre, a.stock_minimo AS minimo, u.simbolo AS unidad, COALESCE(SUM(e.saldo), 0) AS saldo
       FROM articulos a
       LEFT JOIN existencias e ON e.articulo_id = a.id
       LEFT JOIN unidades_medida u ON u.id = a.unidad_medida_id
      WHERE a.deleted_at IS NULL AND a.estado = 1 AND a.maneja_inventario = 1 AND a.stock_minimo > 0
      GROUP BY a.id, a.uuid, a.codigo, a.nombre, a.stock_minimo, u.simbolo
     HAVING saldo <= minimo
      ORDER BY COALESCE(SUM(e.saldo), 0) / a.stock_minimo`,
  );
  return filas.map((a) => {
    const saldo = Number(a.saldo);
    return {
      severidad: saldo <= 0 ? 'alta' : 'media',
      titulo: `${a.nombre}${a.codigo ? ` (${a.codigo})` : ''}`,
      detalle: `Saldo ${saldo.toLocaleString('es')} ${a.unidad || ''} — mínimo ${Number(a.minimo).toLocaleString('es')}.`,
      enlace: `/inventarios/kardex?articuloUuid=${a.uuid}`,
    };
  });
}

async function alertasMantenimiento() {
  const [vencidas, ordenes] = await Promise.all([
    q(
      `SELECT p.uuid, p.fecha_programada AS fecha, p.prioridad, e.codigo, e.nombre, pl.nombre AS plan
         FROM programaciones_mantenimiento p
         JOIN equipos e ON e.id = p.equipo_id
         LEFT JOIN planes_mantenimiento pl ON pl.id = p.plan_id
        WHERE p.deleted_at IS NULL AND p.estado IN ('PENDIENTE','PROGRAMADA','EN_CURSO') AND p.fecha_programada < CURDATE()
        ORDER BY p.fecha_programada`,
    ),
    q(
      `SELECT o.numero, o.fecha, o.descripcion, e.nombre FROM ordenes_mantenimiento o JOIN equipos e ON e.id = o.equipo_id
        WHERE o.deleted_at IS NULL AND o.estado IN ('ABIERTA','EN_PROCESO') AND o.fecha < DATE_SUB(CURDATE(), INTERVAL 15 DAY)
        ORDER BY o.fecha`,
    ),
  ]);
  const dias = (f) => Math.round((Date.now() - new Date(`${String(f).slice(0, 10)}T12:00:00`).getTime()) / 86400000);
  return [
    ...vencidas.map((p) => ({
      severidad: ['ALTA', 'CRITICA'].includes(p.prioridad) || dias(p.fecha) > 15 ? 'alta' : 'media',
      titulo: `${p.codigo} ${p.nombre}: mantenimiento vencido hace ${dias(p.fecha)} días`,
      detalle: `${p.plan || 'Sin plan'} · programado para ${String(p.fecha).slice(0, 10)}.`,
      enlace: '/inventarios/programaciones-mantenimiento',
    })),
    ...ordenes.map((o) => ({
      severidad: 'baja',
      titulo: `Orden ${o.numero} abierta hace ${dias(o.fecha)} días`,
      detalle: `${o.nombre}: ${o.descripcion}`,
      enlace: '/inventarios/ordenes-mantenimiento',
    })),
  ];
}

async function alertasMezclas() {
  const filas = await q(
    `SELECT m.codigo, m.nombre, v.created_at AS creada FROM mezclas m JOIN mezcla_versiones v ON v.mezcla_id = m.id
      WHERE m.deleted_at IS NULL AND v.estado_prueba = 'PENDIENTE_APROBACION' ORDER BY v.created_at`,
  );
  return filas.map((m) => ({
    severidad: 'media',
    titulo: `${m.codigo} pendiente de aprobación`,
    detalle: `${m.nombre || ''} — no se puede usar en Programar aspersión hasta aprobarla.`,
    enlace: '/sanidad-vegetal/mezclas',
  }));
}

// Semanas de registro con movimientos de racimos que no se han liquidado, de las últimas 8. No cuentan la semana en curso ni la anterior
// (la anterior se liquida normalmente durante la semana siguiente).
async function alertasLiquidacion(fincas, actual) {
  if (!actual || fincas.length === 0) return [];
  const filas = await q(
    `SELECT f.nombre, s.codigo, s.fecha_inicio AS f
       FROM (SELECT DISTINCT finca_id, semana_registro_id FROM racimo_movimientos
              WHERE deleted_at IS NULL AND finca_id IN (:ids)) m
       JOIN semanas s ON s.id = m.semana_registro_id
       JOIN fincas f ON f.id = m.finca_id
       LEFT JOIN finca_semana_liquidaciones l ON l.finca_id = m.finca_id AND l.semana_id = m.semana_registro_id AND l.deleted_at IS NULL
      WHERE l.id IS NULL AND s.fecha_inicio < DATE_SUB(:inicio, INTERVAL 1 WEEK) AND s.fecha_inicio >= DATE_SUB(:inicio, INTERVAL 8 WEEK)
      ORDER BY f.nombre, s.fecha_inicio`,
    { ids: fincas.map((f) => f.id), inicio: actual.fechaInicio },
  );
  const porFinca = new Map();
  for (const r of filas) {
    if (!porFinca.has(r.nombre)) porFinca.set(r.nombre, []);
    porFinca.get(r.nombre).push(r.codigo);
  }
  return [...porFinca.entries()].map(([nombre, codigos]) => ({
    severidad: codigos.length >= 2 ? 'media' : 'baja',
    titulo: `${nombre}: ${codigos.length} semana(s) sin liquidar`,
    detalle: codigos.join(', '),
    enlace: '/racimos/movimientos',
  }));
}

async function alertasFrac(user) {
  const lista = await fracLimiteService.alertas(user);
  return lista.map((a) => ({
    severidad: a.tipo === 'APLICACIONES' || a.tipo === 'CONSECUTIVAS' ? 'alta' : 'media',
    titulo: `${a.fincaNombre}: FRAC ${a.fracCodigo}${a.ingredientes ? ` (${a.ingredientes})` : ''}`,
    detalle: `${a.regla}: ${a.detalle}.`,
    enlace: '/sanidad-vegetal/alertas',
  }));
}

export const alertasService = {
  async centro(user) {
    const [actual, fincas] = await Promise.all([semanaActual(), fincasPropias(user)]);
    const grupos = [
      { clave: 'ratio', titulo: 'Ratio de producción', calcular: () => alertasRatio(fincas, actual) },
      { clave: 'liquidacion', titulo: 'Semanas sin liquidar', calcular: () => alertasLiquidacion(fincas, actual) },
      { clave: 'frac', titulo: 'Límites FRAC (Sanidad Vegetal)', calcular: () => alertasFrac(user) },
      { clave: 'mezclas', titulo: 'Mezclas pendientes de aprobación', calcular: () => alertasMezclas() },
      { clave: 'stock', titulo: 'Inventario bajo el stock mínimo', calcular: () => alertasStock() },
      { clave: 'mantenimiento', titulo: 'Mantenimiento de equipos', calcular: () => alertasMantenimiento() },
    ];
    const resultados = await Promise.all(
      grupos.map(async (g) => {
        try {
          return { clave: g.clave, titulo: g.titulo, alertas: await g.calcular(), error: null };
        } catch (err) {
          logger.error(`Centro de alertas (${g.clave}): ${err.message}`);
          return { clave: g.clave, titulo: g.titulo, alertas: [], error: 'No se pudo calcular este grupo' };
        }
      }),
    );
    return { generadoEn: new Date().toISOString(), hoy: hoyIso(), semanaActual: actual?.codigo || null, grupos: resultados };
  },
};

export default alertasService;
