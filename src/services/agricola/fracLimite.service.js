import { QueryTypes } from 'sequelize';
import { sequelize } from '../../database/connection.js';
import { Finca, Mezcla, FracCodigo, GrupoQuimico } from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';
import { getFincaIdsPermitidas } from '../../utils/fincaScope.js';

// La clasificación FRAC vive en sus propias tablas: ingrediente activo →
// grupo químico (grupos_quimicos) → código FRAC (frac_codigos, que además
// guarda modo de acción y las reglas de manejo de resistencia).
//
// Reglas (FRAC Banana Working Group, Sigatoka negra), por código FRAC y finca,
// en los últimos 12 meses (ventana móvil). Una APLICACIÓN = una aspersión no
// cancelada cuya mezcla activa lleva algún ingrediente de ese código FRAC (si
// lleva dos del mismo grupo cuenta una vez). Reglas evaluadas:
//  - APLICACIONES: máximo de aplicaciones del grupo.
//  - PORCENTAJE: el grupo no supera el % máximo del total de aplicaciones de la finca.
//  - CONSECUTIVAS: máximo de aplicaciones seguidas del grupo (1 = alternancia total).
//  - INTERVALO: tiempo mínimo libre del grupo entre dos aplicaciones.
//  - SOLO_MEZCLA: el grupo solo se usa en mezcla con otro modo de acción.
// "Seguidas" = aplicaciones sucesivas de la finca, tomando como una sola las
// aspersiones del mismo día (sectores de una misma finca el mismo día).
const VENTANA = `a.fecha > DATE_SUB(CURDATE(), INTERVAL 12 MONTH) AND a.fecha <= CURDATE()`;

const SQL_ASPERSIONES = `
  SELECT a.id AS aspersionId, a.finca_id AS fincaId, f.uuid AS fincaUuid, f.nombre AS fincaNombre, f.codigo AS fincaCodigo,
         DATE_FORMAT(a.fecha, '%Y-%m-%d') AS fecha, a.ciclo_uuid AS cicloUuid, a.ciclo_parte AS cicloParte, fc.codigo AS fracCodigo
    FROM aspersion_programaciones a
    JOIN fincas f ON f.id = a.finca_id
    LEFT JOIN mezcla_versiones v ON v.mezcla_id = a.mezcla_id AND v.activa = 1
    LEFT JOIN mezcla_componentes c ON c.mezcla_version_id = v.id
    LEFT JOIN articulo_ingredientes_activos r ON r.articulo_id = c.articulo_id
    LEFT JOIN ingredientes_activos ia ON ia.id = r.ingrediente_activo_id AND ia.deleted_at IS NULL
    LEFT JOIN grupos_quimicos g ON g.id = ia.grupo_quimico_id
    LEFT JOIN frac_codigos fc ON fc.id = g.frac_codigo_id
   WHERE a.deleted_at IS NULL AND a.estado <> 'CANCELADA' AND ${VENTANA}
     {{FINCAS}}
   ORDER BY a.finca_id, a.fecha, a.id
`;

// Por finca: aspersiones (con su set de códigos FRAC) y "días" (aspersiones del mismo día unidas).
async function historialPorFinca(fincaIds) {
  const filtro = fincaIds?.length ? 'AND a.finca_id IN (:fincaIds)' : '';
  const filas = await sequelize.query(SQL_ASPERSIONES.replace('{{FINCAS}}', filtro), {
    replacements: { fincaIds: fincaIds || [] },
    type: QueryTypes.SELECT,
  });
  const fincas = new Map();
  for (const f of filas) {
    const id = Number(f.fincaId);
    if (!fincas.has(id)) fincas.set(id, { fincaId: id, fincaUuid: f.fincaUuid, fincaNombre: f.fincaNombre, fincaCodigo: f.fincaCodigo, porAspersion: new Map() });
    const finca = fincas.get(id);
    if (!finca.porAspersion.has(f.aspersionId)) finca.porAspersion.set(f.aspersionId, { fecha: f.fecha, cicloUuid: f.cicloUuid || `asp-${f.aspersionId}`, cicloParte: f.cicloParte, codigos: new Set() });
    if (f.fracCodigo) finca.porAspersion.get(f.aspersionId).codigos.add(f.fracCodigo);
  }
  for (const finca of fincas.values()) {
    const aspersiones = [...finca.porAspersion.values()];
    finca.aspersiones = aspersiones;
    const dias = new Map();
    for (const a of aspersiones) {
      if (!dias.has(a.fecha)) dias.set(a.fecha, { fecha: a.fecha, codigos: new Set() });
      for (const c of a.codigos) dias.get(a.fecha).codigos.add(c);
    }
    finca.dias = [...dias.values()].sort((x, y) => x.fecha.localeCompare(y.fecha));
    finca.ciclos = construirCiclos(aspersiones);
  }
  return fincas;
}

// CICLO = una APLICACIÓN, declarada explícitamente (aspersion_programaciones.ciclo_uuid): puede hacerse en
// varias partes/días (ejecución parcial o aspersiones unidas al ejecutar). Cuenta como UNA aplicación para el
// máximo, el %, las consecutivas y el intervalo. inicio/fin = primera/última fecha de sus partes.
function construirCiclos(aspersiones) {
  const porCiclo = new Map();
  for (const a of aspersiones) {
    const clave = a.cicloUuid || a.fecha;
    if (!porCiclo.has(clave)) porCiclo.set(clave, { cicloUuid: clave, inicio: a.fecha, fin: a.fecha, fechas: [], codigos: new Set(), partes: 0 });
    const c = porCiclo.get(clave);
    c.partes += 1;
    if (a.fecha < c.inicio) c.inicio = a.fecha;
    if (a.fecha > c.fin) c.fin = a.fecha;
    if (!c.fechas.includes(a.fecha)) c.fechas.push(a.fecha);
    for (const x of a.codigos) c.codigos.add(x);
  }
  return [...porCiclo.values()].sort((x, y) => x.inicio.localeCompare(y.inicio) || x.fin.localeCompare(y.fin));
}

async function reglasPorCodigo() {
  const filas = await FracCodigo.findAll();
  return new Map(
    filas.map((l) => [
      l.codigo,
      {
        max: l.maxAplicaciones,
        maxPct: l.maxPorcentajeAplicaciones !== null ? Number(l.maxPorcentajeAplicaciones) : null,
        maxConsecutivas: l.maxConsecutivas,
        intervaloDias: l.intervaloMinimoDias,
        soloMezclas: Boolean(l.soloEnMezclas),
      },
    ]),
  );
}

const diasEntre = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);
const REGLA_ROTULO = {
  APLICACIONES: 'Máximo de aplicaciones (12 meses)',
  PORCENTAJE: '% de las aplicaciones',
  CONSECUTIVAS: 'Aplicaciones consecutivas',
  INTERVALO: 'Intervalo mínimo entre aplicaciones',
  SOLO_MEZCLA: 'Uso solo en mezclas',
};

const ordenCodigo = (c) => (/^\d+$/.test(c) ? [0, Number(c), ''] : [1, 0, c]);
const compararCodigos = (a, b) => {
  const [ta, na, sa] = ordenCodigo(a);
  const [tb, nb, sb] = ordenCodigo(b);
  return ta - tb || na - nb || sa.localeCompare(sb);
};

// Evalúa todas las reglas de UNA finca por CICLOS; devuelve alertas { fracCodigo, tipo, detalle, ultimaFecha, ... }.
function evaluarFinca(finca, reglas) {
  const alertas = [];
  const ciclos = finca.ciclos;
  const total = ciclos.length;
  const codigos = new Set(ciclos.flatMap((c) => [...c.codigos]));
  for (const codigo of codigos) {
    const regla = reglas.get(codigo);
    if (!regla) continue;
    const ciclosGrupo = ciclos.filter((c) => c.codigos.has(codigo));
    const aplicaciones = ciclosGrupo.length;
    const ultimaFecha = ciclosGrupo[ciclosGrupo.length - 1]?.fin || null;

    if (regla.max !== null && aplicaciones > regla.max) {
      alertas.push({ fracCodigo: codigo, tipo: 'APLICACIONES', aplicaciones, limite: regla.max, exceso: aplicaciones - regla.max, ultimaFecha, detalle: `${aplicaciones} aplicaciones (máx. ${regla.max})` });
    }
    if (regla.maxPct !== null && total > 0) {
      const porcentaje = Math.round((aplicaciones / total) * 1000) / 10;
      if (porcentaje > regla.maxPct) {
        alertas.push({ fracCodigo: codigo, tipo: 'PORCENTAJE', aplicaciones, limite: regla.maxPct, porcentaje, totalAplicaciones: total, exceso: Math.round((porcentaje - regla.maxPct) * 10) / 10, ultimaFecha, detalle: `${aplicaciones} de ${total} aplicaciones (${porcentaje}%, máx. ${regla.maxPct}%)` });
      }
    }
    if (regla.maxConsecutivas !== null) {
      let racha = 0;
      let excesos = 0;
      let ultimaRacha = null;
      let maxRacha = 0;
      for (const c of ciclos) {
        if (c.codigos.has(codigo)) {
          racha += 1;
          maxRacha = Math.max(maxRacha, racha);
          if (racha > regla.maxConsecutivas) {
            excesos += 1;
            ultimaRacha = c.fin;
          }
        } else racha = 0;
      }
      if (excesos > 0) {
        alertas.push({ fracCodigo: codigo, tipo: 'CONSECUTIVAS', aplicaciones, limite: regla.maxConsecutivas, exceso: excesos, ultimaFecha: ultimaRacha, detalle: `hasta ${maxRacha} aplicaciones seguidas (máx. ${regla.maxConsecutivas}); ${excesos} vez/veces pasó el límite` });
      }
    }
    if (regla.intervaloDias !== null) {
      let cortos = 0;
      let minimo = Infinity;
      let ultima = null;
      for (let k = 1; k < ciclosGrupo.length; k += 1) {
        const gap = diasEntre(ciclosGrupo[k - 1].fin, ciclosGrupo[k].inicio);
        if (gap < regla.intervaloDias) {
          cortos += 1;
          minimo = Math.min(minimo, gap);
          ultima = ciclosGrupo[k].inicio;
        }
      }
      if (cortos > 0) {
        alertas.push({ fracCodigo: codigo, tipo: 'INTERVALO', aplicaciones, limite: regla.intervaloDias, exceso: cortos, ultimaFecha: ultima, detalle: `${cortos} aplicación(es) con menos de ${regla.intervaloDias} días desde la anterior (mínimo ${minimo} ${minimo === 1 ? 'día' : 'días'})` });
      }
    }
    if (regla.soloMezclas) {
      // Una aspersión (tanque) con el grupo y sin otro modo de acción en la mezcla.
      const solas = finca.aspersiones.filter((a) => a.codigos.has(codigo) && a.codigos.size === 1);
      if (solas.length > 0) {
        alertas.push({ fracCodigo: codigo, tipo: 'SOLO_MEZCLA', aplicaciones, limite: 0, exceso: solas.length, ultimaFecha: solas[solas.length - 1].fecha, detalle: `${solas.length} aplicación(es) sin otro modo de acción en la mezcla` });
      }
    }
  }
  return alertas;
}

export const fracLimiteService = {
  // Un renglón por código FRAC, con los ingredientes que lo usan y sus reglas.
  async list() {
    const filas = await sequelize.query(
      `SELECT fc.codigo AS fracCodigo, fc.modo_accion AS modoAccion, fc.max_aplicaciones AS maxAplicaciones,
              fc.max_porcentaje_aplicaciones AS maxPorcentaje, fc.max_consecutivas AS maxConsecutivas,
              fc.intervalo_minimo_dias AS intervaloMinimoDias, fc.solo_en_mezclas AS soloEnMezclas, fc.restricciones, fc.fuente,
              COUNT(ia.id) AS ingredientes, GROUP_CONCAT(ia.nombre ORDER BY ia.nombre SEPARATOR ', ') AS nombres
         FROM frac_codigos fc
         LEFT JOIN grupos_quimicos g ON g.frac_codigo_id = fc.id
         LEFT JOIN ingredientes_activos ia ON ia.grupo_quimico_id = g.id AND ia.deleted_at IS NULL
        GROUP BY fc.id, fc.codigo, fc.modo_accion, fc.max_aplicaciones, fc.max_porcentaje_aplicaciones, fc.max_consecutivas,
                 fc.intervalo_minimo_dias, fc.solo_en_mezclas, fc.restricciones, fc.fuente`,
      { type: QueryTypes.SELECT },
    );
    return filas
      .map((f) => ({
        ...f,
        ingredientes: Number(f.ingredientes),
        nombres: f.nombres || '',
        maxAplicaciones: f.maxAplicaciones ?? null,
        maxPorcentaje: f.maxPorcentaje !== null && f.maxPorcentaje !== undefined ? Number(f.maxPorcentaje) : null,
        maxConsecutivas: f.maxConsecutivas ?? null,
        intervaloMinimoDias: f.intervaloMinimoDias ?? null,
        soloEnMezclas: Boolean(f.soloEnMezclas),
      }))
      .sort((a, b) => compararCodigos(a.fracCodigo, b.fracCodigo));
  },

  // Catálogo de grupos químicos (con su código FRAC y modo de acción) para el selector del ingrediente activo.
  async listGrupos() {
    const grupos = await GrupoQuimico.findAll({
      include: [{ model: FracCodigo, as: 'frac', attributes: ['codigo', 'modoAccion'] }],
    });
    const conteo = await sequelize.query(
      'SELECT grupo_quimico_id AS id, COUNT(*) AS n FROM ingredientes_activos WHERE deleted_at IS NULL AND grupo_quimico_id IS NOT NULL GROUP BY grupo_quimico_id',
      { type: QueryTypes.SELECT },
    );
    const porGrupo = new Map(conteo.map((c) => [Number(c.id), Number(c.n)]));
    return grupos
      .map((g) => ({ uuid: g.uuid, nombre: g.nombre, fracCodigo: g.frac?.codigo || '', modoAccion: g.frac?.modoAccion || '', ingredientes: porGrupo.get(g.id) || 0 }))
      .sort((a, b) => compararCodigos(a.fracCodigo, b.fracCodigo) || a.nombre.localeCompare(b.nombre, 'es'));
  },

  async setLimite(codigo, { maxAplicaciones, maxPorcentaje, maxConsecutivas, intervaloMinimoDias, soloEnMezclas, modoAccion } = {}, actorId) {
    const frac = await FracCodigo.findOne({ where: { codigo } });
    if (!frac) throw ApiError.notFound('Código FRAC no encontrado');
    const numOrNull = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
    const cambios = { updatedBy: actorId };
    if (maxAplicaciones !== undefined) cambios.maxAplicaciones = numOrNull(maxAplicaciones);
    if (maxPorcentaje !== undefined) cambios.maxPorcentajeAplicaciones = numOrNull(maxPorcentaje);
    if (maxConsecutivas !== undefined) cambios.maxConsecutivas = numOrNull(maxConsecutivas);
    if (intervaloMinimoDias !== undefined) cambios.intervaloMinimoDias = numOrNull(intervaloMinimoDias);
    if (soloEnMezclas !== undefined) cambios.soloEnMezclas = Boolean(soloEnMezclas);
    if (modoAccion !== undefined) cambios.modoAccion = String(modoAccion || '').trim() || null;
    await frac.update(cambios);
    return { fracCodigo: codigo };
  },

  // ─── Catálogo: códigos FRAC y grupos químicos ───

  async createCodigo({ codigo, modoAccion }, actorId) {
    const limpio = String(codigo || '').trim().toUpperCase();
    if (!limpio) throw ApiError.badRequest('Indica el código FRAC');
    if (await FracCodigo.findOne({ where: { codigo: limpio } })) throw ApiError.conflict('Ya existe ese código FRAC');
    const creado = await FracCodigo.create({ codigo: limpio, modoAccion: String(modoAccion || '').trim() || null, createdBy: actorId });
    return { uuid: creado.uuid, fracCodigo: creado.codigo };
  },

  async deleteCodigo(codigo) {
    const frac = await FracCodigo.findOne({ where: { codigo } });
    if (!frac) throw ApiError.notFound('Código FRAC no encontrado');
    const grupos = await GrupoQuimico.count({ where: { fracCodigoId: frac.id } });
    if (grupos > 0) throw ApiError.conflict(`No se puede eliminar: tiene ${grupos} grupo(s) químico(s) asociado(s)`);
    await frac.destroy();
  },

  async createGrupo({ nombre, fracCodigo }, actorId) {
    const limpio = String(nombre || '').trim();
    if (!limpio) throw ApiError.badRequest('Indica el nombre del grupo químico');
    const frac = await FracCodigo.findOne({ where: { codigo: fracCodigo } });
    if (!frac) throw ApiError.notFound('Código FRAC no encontrado');
    if (await GrupoQuimico.findOne({ where: { nombre: limpio, fracCodigoId: frac.id } })) throw ApiError.conflict('Ya existe ese grupo químico en ese código FRAC');
    const creado = await GrupoQuimico.create({ nombre: limpio, fracCodigoId: frac.id, createdBy: actorId });
    return { uuid: creado.uuid, nombre: creado.nombre, fracCodigo: frac.codigo };
  },

  async updateGrupo(uuid, { nombre, fracCodigo }, actorId) {
    const grupo = await GrupoQuimico.findOne({ where: { uuid } });
    if (!grupo) throw ApiError.notFound('Grupo químico no encontrado');
    const cambios = { updatedBy: actorId };
    if (nombre !== undefined) {
      const limpio = String(nombre).trim();
      if (!limpio) throw ApiError.badRequest('Indica el nombre del grupo químico');
      cambios.nombre = limpio;
    }
    if (fracCodigo !== undefined) {
      const frac = await FracCodigo.findOne({ where: { codigo: fracCodigo } });
      if (!frac) throw ApiError.notFound('Código FRAC no encontrado');
      cambios.fracCodigoId = frac.id;
    }
    const duplicado = await GrupoQuimico.findOne({ where: { nombre: cambios.nombre ?? grupo.nombre, fracCodigoId: cambios.fracCodigoId ?? grupo.fracCodigoId } });
    if (duplicado && duplicado.id !== grupo.id) throw ApiError.conflict('Ya existe ese grupo químico en ese código FRAC');
    await grupo.update(cambios);
    return { uuid: grupo.uuid };
  },

  async deleteGrupo(uuid) {
    const grupo = await GrupoQuimico.findOne({ where: { uuid } });
    if (!grupo) throw ApiError.notFound('Grupo químico no encontrado');
    const [{ n }] = await sequelize.query('SELECT COUNT(*) AS n FROM ingredientes_activos WHERE grupo_quimico_id = :id AND deleted_at IS NULL', {
      replacements: { id: grupo.id },
      type: QueryTypes.SELECT,
    });
    if (Number(n) > 0) throw ApiError.conflict(`No se puede eliminar: ${n} ingrediente(s) activo(s) usan este grupo`);
    await grupo.destroy();
  },

  // Fincas que incumplen alguna regla FRAC (ver cabecera del archivo).
  async alertas(user) {
    const fincaIds = getFincaIdsPermitidas(user);
    const [historial, reglas, codigos] = await Promise.all([historialPorFinca(fincaIds), reglasPorCodigo(), this.list()]);
    const nombresPorFrac = Object.fromEntries(codigos.map((f) => [f.fracCodigo, f.nombres]));
    const alertas = [];
    for (const finca of historial.values()) {
      for (const a of evaluarFinca(finca, reglas)) {
        alertas.push({
          ...a,
          fincaId: finca.fincaId,
          fincaUuid: finca.fincaUuid,
          fincaNombre: finca.fincaNombre,
          fincaCodigo: finca.fincaCodigo,
          regla: REGLA_ROTULO[a.tipo],
          ingredientes: nombresPorFrac[a.fracCodigo] || '',
        });
      }
    }
    return alertas.sort(
      (a, b) => a.fincaNombre.localeCompare(b.fincaNombre, 'es') || compararCodigos(a.fracCodigo, b.fracCodigo) || a.tipo.localeCompare(b.tipo),
    );
  },

  // Detalle para comprobar una alerta: TODAS las aspersiones de la finca en los últimos 12 meses (en orden),
  // con las del grupo FRAC marcadas y, según la regla, cuáles son las que la incumplen.
  async detalleAlerta({ fincaUuid, fracCodigo, tipo }, user) {
    const finca = await Finca.findOne({ where: { uuid: fincaUuid } });
    if (!finca) throw ApiError.notFound('Finca no encontrada');
    const permitidos = getFincaIdsPermitidas(user);
    if (permitidos && !permitidos.includes(finca.id)) throw ApiError.notFound('Finca no encontrada');
    const frac = await FracCodigo.findOne({ where: { codigo: fracCodigo } });
    if (!frac) throw ApiError.notFound('Código FRAC no encontrado');

    const filas = await sequelize.query(
      `SELECT a.id AS id, a.uuid AS uuid, a.numero AS numero, DATE_FORMAT(a.fecha, '%Y-%m-%d') AS fecha, a.hectareas AS hectareas,
              a.medio AS medio, a.estado AS estado, a.ciclo_uuid AS cicloUuid, a.ciclo_parte AS cicloParte, ca.aeronave AS aeronave, m.nombre AS mezcla, m.codigo AS mezclaCodigo,
              fc.codigo AS fracCodigo, ia.nombre AS ingrediente, art.nombre AS insumo
         FROM aspersion_programaciones a
         LEFT JOIN comprobantes_aspersion ca ON ca.aspersion_programacion_id = a.id AND ca.deleted_at IS NULL
         LEFT JOIN mezclas m ON m.id = a.mezcla_id
         LEFT JOIN mezcla_versiones v ON v.mezcla_id = a.mezcla_id AND v.activa = 1
         LEFT JOIN mezcla_componentes c ON c.mezcla_version_id = v.id
         LEFT JOIN articulos art ON art.id = c.articulo_id
         LEFT JOIN articulo_ingredientes_activos r ON r.articulo_id = c.articulo_id
         LEFT JOIN ingredientes_activos ia ON ia.id = r.ingrediente_activo_id AND ia.deleted_at IS NULL
         LEFT JOIN grupos_quimicos g ON g.id = ia.grupo_quimico_id
         LEFT JOIN frac_codigos fc ON fc.id = g.frac_codigo_id
        WHERE a.deleted_at IS NULL AND a.estado <> 'CANCELADA' AND a.finca_id = :fincaId AND ${VENTANA}
        ORDER BY a.fecha, a.id`,
      { replacements: { fincaId: finca.id }, type: QueryTypes.SELECT },
    );
    const porId = new Map();
    for (const f of filas) {
      if (!porId.has(f.id)) {
        porId.set(f.id, { uuid: f.uuid, numero: f.numero, fecha: f.fecha, hectareas: Number(f.hectareas), medio: f.medio, aeronave: f.aeronave, estado: f.estado, cicloUuid: f.cicloUuid || `asp-${f.id}`, cicloParte: f.cicloParte, mezcla: f.mezcla || f.mezclaCodigo || '—', codigos: new Set(), ingredientesGrupo: new Set(), insumosGrupo: new Set(), otrosGrupos: new Set() });
      }
      const a = porId.get(f.id);
      if (f.fracCodigo) {
        a.codigos.add(f.fracCodigo);
        if (f.fracCodigo === fracCodigo) {
          a.ingredientesGrupo.add(f.ingrediente);
          if (f.insumo) a.insumosGrupo.add(f.insumo);
        }
        else a.otrosGrupos.add(f.fracCodigo);
      }
    }
    const aspersiones = [...porId.values()];
    const regla = {
      max: frac.maxAplicaciones,
      maxPct: frac.maxPorcentajeAplicaciones !== null ? Number(frac.maxPorcentajeAplicaciones) : null,
      maxConsecutivas: frac.maxConsecutivas,
      intervaloDias: frac.intervaloMinimoDias,
    };
    // Ciclos (cada uno = una aplicación, aunque tenga varias partes/días) y su numeración dentro del grupo.
    const ciclos = construirCiclos(aspersiones);
    const cicloDe = (a) => ciclos.find((c) => c.cicloUuid === a.cicloUuid);
    let nGrupo = 0;
    let racha = 0;
    let finAnteriorGrupo = null;
    const infoCiclo = new Map(); // cicloUuid -> { n, racha, diasDesdeAnterior }
    for (const c of ciclos) {
      if (c.codigos.has(fracCodigo)) {
        nGrupo += 1;
        racha += 1;
        infoCiclo.set(c.cicloUuid, { n: nGrupo, racha, diasDesdeAnterior: finAnteriorGrupo ? diasEntre(finAnteriorGrupo, c.inicio) : null });
        finAnteriorGrupo = c.fin;
      } else racha = 0;
    }
    const salida = aspersiones.map((a) => {
      const tieneGrupo = a.codigos.has(fracCodigo);
      const ciclo = cicloDe(a);
      const info = tieneGrupo ? infoCiclo.get(ciclo.cicloUuid) : null;
      let marca = null;
      if (tieneGrupo) {
        if (tipo === 'APLICACIONES' && regla.max !== null && info.n > regla.max) marca = `Excede (aplicación n.º ${info.n} de ${regla.max})`;
        if (tipo === 'CONSECUTIVAS' && regla.maxConsecutivas !== null && info.racha > regla.maxConsecutivas) marca = `Seguida n.º ${info.racha} (máx. ${regla.maxConsecutivas})`;
        if (tipo === 'INTERVALO' && regla.intervaloDias !== null && info.diasDesdeAnterior !== null && info.diasDesdeAnterior < regla.intervaloDias) marca = `${info.diasDesdeAnterior} ${info.diasDesdeAnterior === 1 ? 'día' : 'días'} desde la anterior (mín. ${regla.intervaloDias})`;
        if (tipo === 'SOLO_MEZCLA' && a.codigos.size === 1) marca = 'Sin otro modo de acción';
      }
      return {
        uuid: a.uuid,
        numero: a.numero,
        fecha: a.fecha,
        mezcla: a.mezcla,
        hectareas: a.hectareas,
        medio: a.medio,
        aeronave: a.aeronave || null,
        estado: a.estado,
        tieneGrupo,
        // Ciclo (aplicación) al que pertenece y sus fechas, para ver que dos días seguidos son una sola aplicación.
        ciclo: ciclo.partes > 1 ? `${ciclo.inicio} → ${ciclo.fin}` : null,
        cicloParte: ciclo.partes > 1 ? `${a.cicloParte} de ${ciclo.partes}` : null,
        cicloN: info ? info.n : null,
        insumosGrupo: [...a.insumosGrupo].join(', '),
        ingredientesGrupo: [...a.ingredientesGrupo].join(', '),
        otrosGrupos: [...a.otrosGrupos].sort(compararCodigos).join(', '),
        // Días desde el fin de la aplicación anterior del grupo (solo en la primera aspersión del ciclo).
        diasDesdeAnterior: info && a.fecha === ciclo.inicio && a.cicloParte === 1 ? info.diasDesdeAnterior : null,
        marca,
      };
    });
    const conGrupo = nGrupo; // aplicaciones (ciclos) del grupo
    return {
      finca: { uuid: finca.uuid, nombre: finca.nombre, codigo: finca.codigo },
      fracCodigo,
      modoAccion: frac.modoAccion,
      tipo,
      regla: REGLA_ROTULO[tipo] || tipo,
      reglas: { ...regla, soloEnMezclas: Boolean(frac.soloEnMezclas) },
      restricciones: frac.restricciones,
      totalAspersiones: ciclos.length,
      totalAspersionesFisicas: salida.length,
      aplicacionesDelGrupo: conGrupo,
      aspersiones: salida,
    };
  },

  // Antes de programar: ¿esta mezcla, aplicada HOY en esta finca, rompería alguna regla FRAC?
  async verificar({ fincaUuid, mezclaUuid }, user) {
    const finca = await Finca.findOne({ where: { uuid: fincaUuid } });
    if (!finca) throw ApiError.notFound('Finca no encontrada');
    const mezcla = await Mezcla.findOne({ where: { uuid: mezclaUuid } });
    if (!mezcla) throw ApiError.notFound('Mezcla no encontrada');
    const permitidos = getFincaIdsPermitidas(user);
    if (permitidos && !permitidos.includes(finca.id)) throw ApiError.notFound('Finca no encontrada');

    const grupos = await sequelize.query(
      `SELECT fc.codigo AS fracCodigo, GROUP_CONCAT(DISTINCT ia.nombre SEPARATOR ', ') AS ingredientes
         FROM mezcla_versiones v
         JOIN mezcla_componentes c ON c.mezcla_version_id = v.id
         JOIN articulo_ingredientes_activos r ON r.articulo_id = c.articulo_id
         JOIN ingredientes_activos ia ON ia.id = r.ingrediente_activo_id AND ia.deleted_at IS NULL
         JOIN grupos_quimicos g ON g.id = ia.grupo_quimico_id
         JOIN frac_codigos fc ON fc.id = g.frac_codigo_id
        WHERE v.mezcla_id = :mid AND v.activa = 1
        GROUP BY fc.codigo`,
      { replacements: { mid: mezcla.id }, type: QueryTypes.SELECT },
    );
    if (!grupos.length) return [];

    const [historial, reglas] = await Promise.all([historialPorFinca([finca.id]), reglasPorCodigo()]);
    const base = historial.get(finca.id) || { fincaId: finca.id, aspersiones: [], dias: [], ciclos: [] };
    const hoy = new Date().toISOString().slice(0, 10);
    const codigosMezcla = new Set(grupos.map((g) => g.fracCodigo));
    // Historial hipotético: se agrega la aspersión de hoy como un ciclo nuevo.
    const aspersionesHip = [...base.aspersiones, { fecha: hoy, cicloUuid: `hoy-${hoy}`, cicloParte: 1, codigos: new Set(codigosMezcla) }];
    const hip = { ...base, aspersiones: aspersionesHip, ciclos: construirCiclos(aspersionesHip) };
    const antes = new Map(evaluarFinca(base, reglas).map((a) => [`${a.fracCodigo}|${a.tipo}`, a]));
    const ingredientesPorFrac = Object.fromEntries(grupos.map((g) => [g.fracCodigo, g.ingredientes]));
    const avisos = [];
    for (const a of evaluarFinca(hip, reglas)) {
      if (!codigosMezcla.has(a.fracCodigo)) continue;
      const previa = antes.get(`${a.fracCodigo}|${a.tipo}`);
      // Solo avisa de lo que esta aplicación agrega o empeora.
      if (previa && previa.exceso >= a.exceso) continue;
      avisos.push({ fracCodigo: a.fracCodigo, ingredientes: ingredientesPorFrac[a.fracCodigo], tipo: a.tipo, mensaje: `FRAC ${a.fracCodigo} (${ingredientesPorFrac[a.fracCodigo]}): ${REGLA_ROTULO[a.tipo].toLowerCase()} — ${a.detalle}` });
    }
    return avisos;
  },
};

export default fracLimiteService;
