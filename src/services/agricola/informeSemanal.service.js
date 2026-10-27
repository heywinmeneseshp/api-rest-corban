import { QueryTypes } from 'sequelize';
import { sequelize } from '../../database/connection.js';
import { ApiError } from '../../utils/ApiError.js';
import { assertFincaPermitida, expandirFincaIds } from '../../utils/fincaScope.js';
import { calcularColorSemana } from '../../utils/semanaColor.js';
import { User, Role, Finca } from '../../database/associations.js';
import { ROLES } from '../../constants/roles.constants.js';
import { configuracionService } from '../sistema/configuracion.service.js';
import { mailService } from '../sistema/mail.service.js';
import { informeSemanalHtml } from './informeSemanalHtml.js';
import { racimoMovimientoService } from './racimoMovimiento.service.js';

// Informe semanal de producción de una finca (Reportes → Resumen semanal), con el formato del informe que se usaba en hoja de cálculo:
// indicadores de la semana, repicados y cortados por edad, «infocinta» (la cinta que cumple 12 semanas), ajustes y el cuadro de saldos de
// cintas por lote y edad. Los pesos (neto, vástago, bruto) y la merma no se registran en el sistema.

const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: QueryTypes.SELECT, logging: false });
const EDAD_INFOCINTA = 12;
// Edad en semanas de una cinta (semana de embolse) vista desde una semana de registro: la misma semana = edad 1.
const EDAD_SQL = 'ROUND(DATEDIFF(sr.fecha_inicio, se.fecha_inicio) / 7) + 1';

const r2 = (v) => (v === null ? null : Math.round(v * 100) / 100);

// Color de la cinta y su consecutivo en el año: los colores rotan cada 8 semanas, así que la semana 23 es el 3.er uso de su color.
function cintaDe(anio, numeroSemana) {
  const n = Number(numeroSemana);
  return { color: calcularColorSemana(Number(anio), n), consecutivo: n === 53 ? 1 : Math.floor((n - 1) / 8) + 1 };
}

// Indicadores de producción de una semana: racimos cortados, cajas, hectáreas en producción, embolses y ratio.
async function indicadoresSemana(fincaIds, semana) {
  const rep = { fincaIds, sid: semana.id, f: semana.f };
  const [movs, [cajasRow], ha] = await Promise.all([
    q(
      `SELECT tipo, SUM(cantidad) AS total FROM racimo_movimientos
        WHERE deleted_at IS NULL AND finca_id IN (:fincaIds) AND semana_registro_id = :sid AND COALESCE(es_ajuste, 0) = 0 GROUP BY tipo`,
      rep,
    ),
    q('SELECT COALESCE(SUM(cajas_20kg), 0) AS cajas FROM produccion_semanal WHERE deleted_at IS NULL AND finca_id IN (:fincaIds) AND semana_id = :sid', rep),
    // Hectáreas en producción: último registro de área de cada lote vigente a esa semana.
    q(
      `SELECT COALESCE(SUM(lap.area), 0) AS ha FROM lote_area_produccion lap
        JOIN lotes l ON l.id = lap.lote_id AND l.deleted_at IS NULL
        JOIN semanas s ON s.id = lap.semana_id
       WHERE l.finca_id IN (:fincaIds) AND s.fecha_inicio <= :f
         AND lap.id = (SELECT lap2.id FROM lote_area_produccion lap2 JOIN semanas s2 ON s2.id = lap2.semana_id
                        WHERE lap2.lote_id = lap.lote_id AND s2.fecha_inicio <= :f ORDER BY s2.fecha_inicio DESC, lap2.id DESC LIMIT 1)`,
      rep,
    ),
  ]);
  const tot = Object.fromEntries(movs.map((m) => [m.tipo, Number(m.total)]));
  const procesados = tot.PROCESADO || 0;
  const recusados = tot.RECUSE || 0;
  const cortados = procesados + recusados;
  const hectareas = Number(ha[0]?.ha || 0);
  const cajas = Number(cajasRow?.cajas || 0);
  return {
    racimosProcesados: procesados,
    racimosRecusados: recusados,
    totalCortados: cortados,
    hectareasProduccion: r2(hectareas),
    embolses: tot.EMBOLSE || 0,
    embolsesPorHectarea: hectareas > 0 ? r2((tot.EMBOLSE || 0) / hectareas) : null,
    cajas: r2(cajas),
    cajasPorHectarea: hectareas > 0 ? r2(cajas / hectareas) : null,
    ratio: cortados > 0 && cajas > 0 ? Math.round((cajas / cortados) * 1000) / 1000 : null,
    // No se registran en el sistema.
    pesoNetoRacimo: null,
    pesoVastago: null,
    pesoBrutoRacimo: null,
    merma: null,
  };
}

export const informeSemanalService = {
  async generar({ fincaUuid, semanaUuid }, user) {
    const [finca] = await q('SELECT id, uuid, codigo, nombre FROM fincas WHERE uuid = :u AND deleted_at IS NULL', { u: fincaUuid });
    if (!finca) throw ApiError.notFound('Finca no encontrada');
    assertFincaPermitida(user, finca.id);
    const fincaIds = await expandirFincaIds([finca.id]);

    // Semana: la pedida o la última semana cerrada DE ESTA FINCA: la última liquidada; si nunca ha liquidado, la última con racimos
    // cortados antes de la semana en curso; y si no tiene datos, la semana anterior a la en curso.
    const CAMPOS = 's.id, s.uuid, s.codigo, s.anio, s.numero_semana AS n, s.fecha_inicio AS f';
    let semana;
    let criterio = 'elegida';
    if (semanaUuid) {
      [semana] = await q(`SELECT ${CAMPOS} FROM semanas s WHERE s.uuid = :u`, { u: semanaUuid });
    } else {
      [semana] = await q(
        `SELECT ${CAMPOS} FROM finca_semana_liquidaciones l JOIN semanas s ON s.id = l.semana_id
          WHERE l.finca_id IN (:fincaIds) AND l.deleted_at IS NULL ORDER BY s.fecha_inicio DESC LIMIT 1`,
        { fincaIds },
      );
      criterio = 'liquidada';
      if (!semana) {
        [semana] = await q(
          `SELECT ${CAMPOS} FROM racimo_movimientos m JOIN semanas s ON s.id = m.semana_registro_id
            WHERE m.deleted_at IS NULL AND m.finca_id IN (:fincaIds) AND m.tipo IN ('PROCESADO','RECUSE') AND s.fecha_fin < CURDATE()
            ORDER BY s.fecha_inicio DESC LIMIT 1`,
          { fincaIds },
        );
        criterio = 'ultimaConCorte';
      }
      if (!semana) {
        [semana] = await q(
          `SELECT ${CAMPOS} FROM semanas s WHERE s.deleted_at IS NULL AND s.fecha_fin < CURDATE() ORDER BY s.fecha_inicio DESC LIMIT 1`,
        );
        criterio = 'anterior';
      }
    }
    if (!semana) throw ApiError.notFound('Semana no encontrada');
    const rep = { fincaIds, sid: semana.id, f: semana.f };

    // Semanas vecinas, para navegar con las flechas.
    const [[anterior], [siguiente]] = await Promise.all([
      q('SELECT id, uuid, codigo, fecha_inicio AS f FROM semanas WHERE deleted_at IS NULL AND fecha_inicio < :f ORDER BY fecha_inicio DESC LIMIT 1', { f: semana.f }),
      q('SELECT id, uuid, codigo, fecha_inicio AS f FROM semanas WHERE deleted_at IS NULL AND fecha_inicio > :f AND fecha_fin < CURDATE() ORDER BY fecha_inicio LIMIT 1', { f: semana.f }),
    ]);

    const [indicadores, repicados, cortadosEdad, ajustes, [cinta]] = await Promise.all([
      indicadoresSemana(fincaIds, semana),
      q(
        `SELECT ${EDAD_SQL} AS edad, se.codigo AS semanaCodigo, se.anio, se.numero_semana AS numeroSemana, COALESCE(mr.nombre, 'SIN MOTIVO') AS motivo, SUM(m.cantidad) AS cantidad
           FROM racimo_movimientos m
           JOIN semanas sr ON sr.id = m.semana_registro_id JOIN semanas se ON se.id = m.semana_embolse_id
           LEFT JOIN motivos_repique mr ON mr.id = m.motivo_repique_id
          WHERE m.deleted_at IS NULL AND m.finca_id IN (:fincaIds) AND m.semana_registro_id = :sid AND m.tipo = 'REPIQUE' AND COALESCE(m.es_ajuste, 0) = 0
          GROUP BY edad, se.codigo, se.anio, se.numero_semana, motivo ORDER BY edad, motivo`,
        rep,
      ),
      q(
        `SELECT ${EDAD_SQL} AS edad, se.codigo AS semanaCodigo, se.anio, se.numero_semana AS numeroSemana, SUM(m.cantidad) AS cantidad
           FROM racimo_movimientos m
           JOIN semanas sr ON sr.id = m.semana_registro_id JOIN semanas se ON se.id = m.semana_embolse_id
          WHERE m.deleted_at IS NULL AND m.finca_id IN (:fincaIds) AND m.semana_registro_id = :sid AND m.tipo IN ('PROCESADO','RECUSE') AND COALESCE(m.es_ajuste, 0) = 0
          GROUP BY edad, se.codigo, se.anio, se.numero_semana ORDER BY edad`,
        rep,
      ),
      q(
        `SELECT ${EDAD_SQL} AS edad, m.tipo, COALESCE(mr.nombre, mc.nombre, '') AS motivo, SUM(m.cantidad) AS cantidad
           FROM racimo_movimientos m
           JOIN semanas sr ON sr.id = m.semana_registro_id JOIN semanas se ON se.id = m.semana_embolse_id
           LEFT JOIN motivos_repique mr ON mr.id = m.motivo_repique_id LEFT JOIN motivos_recuse mc ON mc.id = m.motivo_recuse_id
          WHERE m.deleted_at IS NULL AND m.finca_id IN (:fincaIds) AND m.semana_registro_id = :sid AND m.es_ajuste = 1
          GROUP BY edad, m.tipo, motivo ORDER BY edad`,
        rep,
      ),
      // Infocinta: la cinta que cumple 12 semanas en la semana del informe, con todo su historial.
      q(
        `SELECT se.codigo AS semana, se.anio, se.numero_semana AS numeroSemana,
                SUM(CASE WHEN m.tipo = 'EMBOLSE' THEN m.cantidad ELSE 0 END) AS embolsado,
                SUM(CASE WHEN m.tipo = 'REPIQUE' THEN m.cantidad ELSE 0 END) AS repicado,
                SUM(CASE WHEN m.tipo = 'RECUSE' THEN m.cantidad ELSE 0 END) AS recusado,
                SUM(CASE WHEN m.tipo = 'PROCESADO' THEN m.cantidad ELSE 0 END) AS procesado
           FROM semanas se
           LEFT JOIN racimo_movimientos m ON m.semana_embolse_id = se.id AND m.deleted_at IS NULL AND m.finca_id IN (:fincaIds)
          WHERE se.deleted_at IS NULL AND se.fecha_inicio = DATE_SUB(:f, INTERVAL ${EDAD_INFOCINTA - 1} WEEK)
          GROUP BY se.id, se.codigo, se.anio, se.numero_semana`,
        rep,
      ),
    ]);

    const cortadosLista = cortadosEdad.map((c) => ({ edad: Number(c.edad), cantidad: Number(c.cantidad), semana: c.semanaCodigo, ...cintaDe(c.anio, c.numeroSemana) }));
    const totalCortadosEdad = cortadosLista.reduce((a, c) => a + c.cantidad, 0);

    const infocinta = cinta
      ? (() => {
          const emb = Number(cinta.embolsado);
          const salidas = Number(cinta.repicado) + Number(cinta.recusado) + Number(cinta.procesado);
          return {
            semana: cinta.semana,
            ...cintaDe(cinta.anio, cinta.numeroSemana),
            edad: EDAD_INFOCINTA,
            embolsado: emb,
            repicado: Number(cinta.repicado),
            recusado: Number(cinta.recusado),
            procesado: Number(cinta.procesado),
            perdidos: emb - salidas,
            recobro: emb > 0 ? Math.round((salidas / emb) * 10000) / 100 : null,
            // Igual que el gráfico de Aprovechamiento: lo cortado (recusado + procesado) sobre lo embolsado, sin los repicados.
            aprovechamiento: emb > 0 ? Math.round(((Number(cinta.recusado) + Number(cinta.procesado)) / emb) * 10000) / 100 : null,
          };
        })()
      : null;

    return {
      finca: { uuid: finca.uuid, codigo: finca.codigo, nombre: finca.nombre },
      semana: { uuid: semana.uuid, codigo: semana.codigo, anio: semana.anio, numeroSemana: semana.n, criterio },
      indicadores,
      semanaAnterior: anterior ? { uuid: anterior.uuid, codigo: anterior.codigo } : null,
      semanaSiguiente: siguiente ? { uuid: siguiente.uuid, codigo: siguiente.codigo } : null,
      repicados: repicados.map((r) => ({ edad: Number(r.edad), semana: r.semanaCodigo, ...cintaDe(r.anio, r.numeroSemana), motivo: r.motivo, cantidad: Number(r.cantidad) })),
      totalRepicados: repicados.reduce((a, r) => a + Number(r.cantidad), 0),
      cortadosPorEdad: cortadosLista.map((c) => ({ ...c, porcentaje: totalCortadosEdad > 0 ? Math.round((c.cantidad / totalCortadosEdad) * 10000) / 100 : 0 })),
      infocinta,
      ajustes: ajustes.map((a) => ({ edad: Number(a.edad), tipo: a.tipo, motivo: a.motivo, cantidad: Number(a.cantidad) })),
    };
  },
};

// Destinatarios del informe de UNA finca. Los correos sueltos reciben siempre. Los usuarios (por rol o elegidos uno a uno) solo reciben
// el informe de sus fincas asignadas: el Administrador y quien no tiene fincas asignadas ven todas (mismo criterio que el resto del
// sistema, ver fincas por usuario). `fincaIds` incluye las fincas del grupo de la finca del informe.
async function destinatariosDeFinca(config, fincaIds) {
  const porEmail = new Map();
  for (const email of config.correos || []) {
    const limpio = String(email || '').trim().toLowerCase();
    if (limpio) porEmail.set(limpio, limpio);
  }
  const condiciones = [];
  if (config.rolesUuids?.length) condiciones.push({ '$roles.uuid$': config.rolesUuids });
  if (config.usuariosUuids?.length) condiciones.push({ uuid: config.usuariosUuids });
  if (condiciones.length) {
    // Usuarios activos que entran por algún rol elegido o porque se eligieron uno a uno.
    const candidatos = await User.findAll({
      where: { estado: true },
      include: [{ model: Role, as: 'roles', attributes: ['uuid'], through: { attributes: [] }, required: false }],
    });
    const elegidos = candidatos.filter(
      (u) => (config.usuariosUuids || []).includes(u.uuid) || (u.roles || []).some((r) => (config.rolesUuids || []).includes(r.uuid)),
    );
    if (elegidos.length) {
      // Con todos sus roles y sus fincas asignadas, para saber si ven esta finca.
      const detalle = await User.findAll({
        where: { id: elegidos.map((u) => u.id) },
        include: [
          { model: Role, as: 'roles', attributes: ['nombre'], through: { attributes: [] }, required: false },
          { model: Finca, as: 'fincas', attributes: ['id'], through: { attributes: [] }, required: false },
        ],
      });
      for (const u of detalle) {
        if (!u.email) continue;
        const esAdmin = (u.roles || []).some((r) => r.nombre === ROLES.ADMINISTRADOR);
        const asignadas = (u.fincas || []).map((f) => f.id);
        if (esAdmin || asignadas.length === 0 || asignadas.some((id) => fincaIds.includes(id))) {
          porEmail.set(u.email.trim().toLowerCase(), u.email);
        }
      }
    }
  }
  return [...porEmail.values()];
}

// Envío manual por correo (botón «Enviar» del informe): a los destinatarios configurados, con un resumen en el cuerpo y el Excel adjunto.
informeSemanalService.enviar = async function enviar({ fincaUuid, semanaUuid, pdfBuffer, pdfNombre }, user) {
  const informe = await informeSemanalService.generar({ fincaUuid, semanaUuid }, user);
  const config = await configuracionService.getInformeSemanalDestinatarios();
  const hayConfig = (config.correos?.length || 0) + (config.rolesUuids?.length || 0) + (config.usuariosUuids?.length || 0) > 0;
  if (!hayConfig) {
    throw ApiError.badRequest('No hay destinatarios configurados para el informe semanal. Configúralos primero (botón Destinatarios).');
  }
  const [finca] = await q('SELECT id FROM fincas WHERE uuid = :u', { u: fincaUuid });
  const destinatarios = await destinatariosDeFinca(config, await expandirFincaIds([finca.id]));
  if (!destinatarios.length) {
    // Hay destinatarios configurados, pero ninguno tiene asignada esta finca: no es un error, simplemente no se envía.
    return { destinatarios: [], omitido: true, semanaCodigo: informe.semana.codigo, fincaNombre: informe.finca.nombre };
  }
  // Misma tabla de Saldo y Movimientos que se ve en la página.
  const movimientos = await racimoMovimientoService
    .getReporteMovimientosSemana({ fincaUuid, semanaRegistroUuid: informe.semana.uuid, anio: informe.semana.anio, cantidadSemanas: 13 }, user)
    .catch(() => null);
  await mailService.sendInformeSemanal({
    destinatarios,
    fincaNombre: informe.finca.nombre,
    semanaCodigo: informe.semana.codigo,
    contenidoHtml: informeSemanalHtml(informe, movimientos),
    pdfBuffer,
    pdfNombre,
    enviadoPor: user?.nombre ? `${user.nombre} ${user.apellido || ''}`.trim() : user?.usuario || null,
  });
  return { destinatarios, semanaCodigo: informe.semana.codigo, fincaNombre: informe.finca.nombre };
};

export default informeSemanalService;
