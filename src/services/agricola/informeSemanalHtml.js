// Cuerpo HTML del correo del Informe semanal, con la misma presentación de la página (Reportes → Resumen semanal): indicadores, cortados
// por edad y cinta barrida, repicados por motivo, ajustes y la tabla de saldo y movimientos. Solo tablas con estilos en línea, para que
// se vea bien en los clientes de correo (Gmail, Outlook).

// Mismos colores de cinta que la app (app-corbana/lib/semanaColor.js).
const COLOR_HEX = {
  Azul: '#2563eb',
  Blanco: '#f8fafc',
  Amarillo: '#eab308',
  Morado: '#7c3aed',
  Rojo: '#dc2626',
  Café: '#78350f',
  Negro: '#111827',
  Verde: '#16a34a',
  Gris: '#6b7280',
};
const COLOR_TEXT = { Blanco: '#111827', Amarillo: '#111827' };

const VERDE = '#14532d';
const BORDE = '#e2e8f0';
const esc = (t) =>
  String(t ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const n0 = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('es-CO', { maximumFractionDigits: 0 }));
const n2 = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const pct = (v) => (v === null || v === undefined ? '—' : `${n2(v)}%`);

const td = (contenido, estilo = '') => `<td style="padding:7px 11px;border-bottom:1px solid ${BORDE};font-size:13px;color:#1f2937;${estilo}">${contenido}</td>`;
const th = (contenido, colspan = 1, estilo = '') =>
  `<th colspan="${colspan}" style="background:${VERDE};color:#ffffff;padding:8px 11px;font-size:13px;font-weight:600;text-align:center;${estilo}">${contenido}</th>`;
const tabla = (filas) =>
  `<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid ${BORDE};border-radius:10px;overflow:hidden;background:#ffffff;">${filas}</table>`;
const punto = (color) =>
  `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${COLOR_HEX[color] || '#94a3b8'};${color === 'Blanco' ? 'border:1px solid #94a3b8;' : ''}vertical-align:middle;margin-right:6px;"></span>`;

// Alturas aproximadas (px) de una fila y de un encabezado con el relleno normal, para igualar las dos columnas de arriba: los clientes de
// correo no estiran tablas, así que a la columna más baja se le da más relleno vertical por fila.
const ALTO_FILA = 33;
const ALTO_CABECERA = 35;
const ESPACIO = 14;

export function informeSemanalHtml(data, movimientos) {
  const ind = data.indicadores;
  const filasCortados = Math.max(1, data.cortadosPorEdad.length);
  const altoIzq = ALTO_CABECERA + 13 * ALTO_FILA;
  const altoDer = 2 * ALTO_CABECERA + filasCortados * ALTO_FILA + (data.infocinta ? ESPACIO + ALTO_CABECERA + 8 * ALTO_FILA : 0);
  const extraIzq = altoDer > altoIzq ? (altoDer - altoIzq) / 13 / 2 : 0;
  const extraCinta = data.infocinta && altoIzq > altoDer ? (altoIzq - altoDer) / 8 / 2 : 0;
  const pad = (extra) => (extra ? `padding-top:${(7 + extra).toFixed(1)}px;padding-bottom:${(7 + extra).toFixed(1)}px;` : '');
  const filasInd = [
    ['Racimos procesados', n0(ind.racimosProcesados), ''],
    ['Racimos recusados', n0(ind.racimosRecusados), ''],
    ['Total cortados', n0(ind.totalCortados), 'total'],
    ['Hectáreas en producción', n2(ind.hectareasProduccion), ''],
    ['Embolses', n0(ind.embolses), ''],
    ['Embolses por hectárea', n2(ind.embolsesPorHectarea), ''],
    ['Cajas producidas 20 kg', n0(ind.cajas), 'fuerte'],
    ['Cajas por hectárea', n2(ind.cajasPorHectarea), ''],
    ['Ratio', n2(ind.ratio), 'fuerte'],
  ];
  const fondo = (tipo) => (tipo === 'total' ? `background:#f1f5f9;font-weight:700;border-top:2px solid ${VERDE};` : tipo === 'fuerte' ? 'background:#f0fdf4;font-weight:700;' : '');
  const indicadores = tabla(
    `<tr>${th(`Indicadores de la semana ${esc(data.semana.codigo)} — ${esc(data.finca.nombre)}`, 2)}</tr>` +
      filasInd.map(([l, v, t]) => `<tr>${td(esc(l), fondo(t) + pad(extraIzq))}${td(esc(v), `text-align:right;font-weight:600;${fondo(t)}${pad(extraIzq)}`)}</tr>`).join('') +
      ['Peso neto racimo', 'Peso vástago', 'Peso bruto racimo', 'Merma']
        .map((l) => `<tr>${td(esc(l), `color:#64748b;${pad(extraIzq)}`)}${td('Sin dato en el sistema', `text-align:right;color:#64748b;font-style:italic;${pad(extraIzq)}`)}</tr>`)
        .join(''),
  );

  const cortados = tabla(
    `<tr>${th('Cortados por edad', 4)}</tr><tr>${th('Cinta')}${th('Edad')}${th('Cortados')}${th('%')}</tr>` +
      (data.cortadosPorEdad.length
        ? data.cortadosPorEdad
            .map((c) => `<tr>${td(`${punto(c.color)}${esc(c.semana)}`, 'white-space:nowrap;')}${td(c.edad, 'text-align:center;')}${td(n0(c.cantidad), 'text-align:right;font-weight:600;')}${td(pct(c.porcentaje), 'text-align:right;color:#64748b;')}</tr>`)
            .join('')
        : `<tr><td colspan="4" style="padding:10px;text-align:center;color:#64748b;font-size:13px;">Sin cortes</td></tr>`),
  );

  const c = data.infocinta;
  const cinta = c
    ? tabla(
        `<tr>${th(`Cinta barrida · ${esc(c.semana)}`, 2)}</tr>` +
          [
            ['Semana de embolse', `${punto(c.color)}${esc(c.semana)}`],
            ['Embolsado', n0(c.embolsado)],
            ['Repicado', n0(c.repicado)],
            ['Recusado', n0(c.recusado)],
            ['Procesado', n0(c.procesado)],
            ['Racimos perdidos', n0(c.perdidos)],
            ['Recobro', pct(c.recobro)],
            ['Aprovechamiento', pct(c.aprovechamiento)],
          ]
            .map(
              ([l, v], i) =>
                `<tr>${td(esc(l), `color:#64748b;${pad(extraCinta)}`)}${td(v, `text-align:right;font-weight:700;white-space:nowrap;${pad(extraCinta)}${i >= 6 ? 'color:#047857;' : i === 5 && c.perdidos !== 0 ? 'color:#be123c;' : ''}`)}</tr>`,
            )
            .join(''),
      )
    : '';

  const porMotivo = new Map();
  for (const r of data.repicados || []) porMotivo.set(r.motivo, (porMotivo.get(r.motivo) || 0) + r.cantidad);
  const motivos = [...porMotivo.entries()].sort((a, b) => b[1] - a[1]);
  const total = 'background:#f1f5f9;font-weight:700;border-top:2px solid ' + VERDE + ';';
  const repicados = tabla(
    `<tr>${th(`Repicados ${esc(data.semana.codigo)} — ${n0(data.totalRepicados)} en total`, 3)}</tr><tr>${th('Motivo')}${th('Cantidad')}${th('%')}</tr>` +
      (motivos.length
        ? motivos.map(([m, n]) => `<tr>${td(esc(m))}${td(n0(n), 'text-align:right;font-weight:600;')}${td(pct((n / data.totalRepicados) * 100), 'text-align:right;color:#64748b;')}</tr>`).join('') +
          `<tr>${td('Total', total)}${td(n0(data.totalRepicados), `text-align:right;${total}`)}${td('100%', `text-align:right;${total}`)}</tr>`
        : `<tr><td colspan="3" style="padding:10px;text-align:center;color:#64748b;font-size:13px;">Sin repicados en la semana.</td></tr>`),
  );

  const ajustes = (data.ajustes || []).length
    ? tabla(
        `<tr>${th('Ajustes', 4)}</tr><tr>${th('Edad')}${th('Tipo')}${th('Motivo')}${th('Cantidad')}</tr>` +
          data.ajustes.map((a) => `<tr>${td(a.edad, 'text-align:center;')}${td(esc(a.tipo))}${td(esc(a.motivo || '—'))}${td(n0(a.cantidad), 'text-align:right;font-weight:600;')}</tr>`).join(''),
      )
    : '';

  // Saldo y movimientos: columnas = cintas con su color.
  let saldo = '';
  const cols = movimientos?.cohortes || [];
  if (cols.length) {
    const cab = cols
      .map(
        (k) =>
          `<th style="background:${COLOR_HEX[k.color] || '#94a3b8'};color:${COLOR_TEXT[k.color] || '#ffffff'};padding:5px 4px;font-size:10px;text-align:center;font-weight:700;white-space:nowrap;">${esc(
            String(k.color || '').toUpperCase(),
          )}<br>${esc(k.semanaCodigo)}<br>Edad ${k.edadSemanas}</th>`,
      )
      .join('');
    const celda = (v, extra = '') =>
      `<td style="padding:5px 4px;border:1px solid ${BORDE};font-size:11px;text-align:center;${Number(v) < 0 ? 'color:#b91c1c;' : ''}${extra}">${Number(v) === 0 ? '—' : n0(v)}</td>`;
    const fila = (titulo, f, extra = '') =>
      `<tr><td style="padding:5px 8px;border:1px solid ${BORDE};font-size:11px;white-space:nowrap;${extra}">${titulo}</td>${cols.map((k) => celda(f(k), extra)).join('')}</tr>`;
    const gris = 'background:#f1f5f9;font-weight:700;';
    const lotes = (movimientos.lotes || []).filter((l) => cols.some((k) => (l.saldoFinal[k.semanaUuid] || 0) !== 0));
    saldo =
      `<h3 style="margin:24px 0 8px;font-size:15px;color:#0f172a;">Saldo y movimientos ${esc(data.semana.codigo)}</h3>` +
      `<div style="overflow-x:auto;"><table cellpadding="0" cellspacing="0" style="border-collapse:collapse;min-width:100%;">` +
      `<tr><th style="background:${VERDE};color:#fff;padding:5px 8px;font-size:11px;text-align:left;">Concepto / Lote</th>${cab}</tr>` +
      fila('Saldo inicial', (k) => k.saldoInicial, gris) +
      fila('Embolsado', (k) => k.totalEmbolsado) +
      fila('Repicado', (k) => -k.totalRepicado) +
      fila('Recusado', (k) => -k.totalRecusado) +
      fila('Procesado', (k) => -k.totalProcesado) +
      fila('Saldo final', (k) => k.saldoFinal, gris) +
      lotes.map((l) => fila(`&nbsp;&nbsp;${esc(l.codigo)}`, (k) => l.saldoFinal[k.semanaUuid] || 0, 'color:#475569;')).join('') +
      `</table></div>`;
  }

  return `
    <table cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 6px;">
      <tr>
        <td style="padding:0 0 10px;font-size:12px;color:#475569;">
          <span style="display:inline-block;border:1px solid ${BORDE};border-radius:999px;padding:4px 12px;margin:0 6px 6px 0;background:#f8fafc;">Año ${esc(data.semana.anio)}</span>
          <span style="display:inline-block;border:1px solid ${BORDE};border-radius:999px;padding:4px 12px;margin:0 6px 6px 0;background:#f8fafc;">Semana ${esc(data.semana.numeroSemana)}</span>
          <span style="display:inline-block;border:1px solid ${BORDE};border-radius:999px;padding:4px 12px;margin:0 6px 6px 0;background:#f8fafc;">IBM ${esc(data.finca.codigo)}</span>
          <span style="display:inline-block;border-radius:999px;padding:4px 12px;margin:0 6px 6px 0;background:#198754;color:#fff;">${esc(data.finca.nombre)} · ${esc(data.semana.codigo)}</span>
        </td>
      </tr>
    </table>
    <table cellpadding="0" cellspacing="0" style="width:100%;">
      <tr>
        <td style="width:50%;vertical-align:top;padding-right:8px;">${indicadores}</td>
        <td style="width:50%;vertical-align:top;padding-left:8px;">${cortados}<div style="height:14px;"></div>${cinta}</td>
      </tr>
    </table>
    <div style="height:16px;"></div>
    <table cellpadding="0" cellspacing="0" style="width:100%;">
      <tr>
        <td style="vertical-align:top;${ajustes ? 'width:50%;padding-right:8px;' : ''}">${repicados}</td>
        ${ajustes ? `<td style="width:50%;vertical-align:top;padding-left:8px;">${ajustes}</td>` : ''}
      </tr>
    </table>
    ${saldo}
  `;
}

export default informeSemanalHtml;
