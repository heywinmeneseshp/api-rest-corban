import nodemailer from 'nodemailer';

const {
  SMTP_HOST,
  SMTP_PORT = '587',
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM = 'noreply@corbana.com',
  APP_URL = 'http://localhost:3003',
} = process.env;

const isConfigured = !!(SMTP_HOST && SMTP_USER && SMTP_PASS);

let transporter = null;

if (isConfigured) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT, 10),
    secure: SMTP_PORT === '465',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export const mailService = {
  async sendPasswordReset(usuario, newPassword) {
    const html = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,.08);">
        <div style="background: linear-gradient(135deg, #166534 0%, #22a35e 100%); padding: 28px 32px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 22px; font-weight: 700;">CORBANA</h1>
          <p style="color: rgba(255,255,255,.85); margin: 4px 0 0; font-size: 13px;">Gestión y Control del Cultivo de Banano</p>
        </div>
        <div style="padding: 32px;">
          <p style="margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.5;">Hola <strong style="color: #166534;">${usuario.nombre} ${usuario.apellido}</strong>,</p>
          <p style="margin: 0 0 20px; color: #374151; font-size: 14px; line-height: 1.5;">Se han restablecido tus credenciales de acceso al sistema. A continuación tus nuevos datos de ingreso:</p>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px 20px; margin-bottom: 20px;">
            <table style="border-collapse: collapse; width: 100%;">
              <tr><td style="padding: 6px 12px 6px 0; color: #166534; font-weight: 600; font-size: 13px; white-space: nowrap; vertical-align: top;">Usuario</td><td style="padding: 6px 0; color: #374151; font-size: 14px; word-break: break-all;">${usuario.usuario}</td></tr>
              <tr><td style="padding: 6px 12px 6px 0; color: #166534; font-weight: 600; font-size: 13px; white-space: nowrap; vertical-align: top;">Correo</td><td style="padding: 6px 0; color: #374151; font-size: 14px; word-break: break-all;">${usuario.email}</td></tr>
              <tr><td style="padding: 6px 12px 6px 0; color: #166534; font-weight: 600; font-size: 13px; white-space: nowrap; vertical-align: top;">Contraseña</td><td style="padding: 6px 0;"><code style="background: #dcfce7; color: #166534; padding: 4px 10px; border-radius: 4px; font-size: 14px; font-weight: 600; letter-spacing: .5px;">${newPassword}</code></td></tr>
            </table>
          </div>
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px;">
            <p style="margin: 0; color: #b91c1c; font-size: 13px; font-weight: 600;">⚠ Por seguridad, cambia tu contraseña lo antes posible después de iniciar sesión.</p>
          </div>
          <table role="presentation" style="width: 100%;"><tr><td align="center">
            <a href="${APP_URL}/login" style="background: linear-gradient(135deg, #166534 0%, #22a35e 100%); color: #fff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 600; display: inline-block;">Ingresar al sistema</a>
          </td></tr></table>
        </div>
        <div style="background: #f9fafb; padding: 16px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; color: #9ca3af; font-size: 11px;">Este mensaje se generó automáticamente, por favor no respondas a este correo.</p>
        </div>
      </div>
    `;

    if (!isConfigured || !transporter) {
      console.log('═══════════════════════════════════════════════');
      console.log('📧  MAIL SERVICE (no configurado)');
      console.log(`To:       ${usuario.email}`);
      console.log(`Subject:  CORBANA — Credenciales restablecidas`);
      console.log(`Usuario:  ${usuario.usuario}`);
      console.log(`Password: ${newPassword}`);
      console.log(`Link:     ${APP_URL}/login`);
      console.log('═══════════════════════════════════════════════');
      return;
    }

    await transporter.sendMail({
      from: SMTP_FROM,
      to: usuario.email,
      subject: 'CORBANA — Credenciales restablecidas',
      html,
    });
  },

  // Aviso de que se cargó una nueva evaluación de Sanidad Vegetal — se
  // manda al rol revisor configurado (ver
  // laborCultural.service.js#obtenerDestinatariosRevisores), pidiéndole que
  // ingrese a revisarla. `destinatarios`/`cc` son arreglos de emails; si no
  // hay ningún revisor que coincida pero SÍ hay CC configurado, el CC pasa
  // a ser el destinatario principal (así el aviso igual llega a alguien en
  // vez de perderse en silencio). Si ninguno de los dos tiene nada, no se
  // manda nada.
  async sendAvisoCargueLabor({ destinatarios, cc, fincaNombre, semanaCodigo, fecha }) {
    const usaCcComoPrincipal = !destinatarios?.length && !!cc?.length;
    const destinatariosFinales = destinatarios?.length ? destinatarios : cc;
    if (!destinatariosFinales?.length) return;

    const html = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,.08);">
        <div style="background: linear-gradient(135deg, #166534 0%, #22a35e 100%); padding: 28px 32px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 22px; font-weight: 700;">CORBANA</h1>
          <p style="color: rgba(255,255,255,.85); margin: 4px 0 0; font-size: 13px;">Sanidad Vegetal — Evaluación de Labores</p>
        </div>
        <div style="padding: 32px;">
          <p style="margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.5;">Hola,</p>
          <p style="margin: 0 0 20px; color: #374151; font-size: 14px; line-height: 1.5;">
            Se ha cargado una nueva evaluación de labores para la finca <strong style="color: #166534;">${fincaNombre}</strong>,
            semana <strong>${semanaCodigo}</strong>, fecha <strong>${fecha}</strong>.
          </p>
          <p style="margin: 0 0 24px; color: #374151; font-size: 14px; line-height: 1.5;">
            Por favor ingresa al sistema y revísala, marcando la revisión correspondiente.
          </p>
          <table role="presentation" style="width: 100%;"><tr><td align="center">
            <a href="${APP_URL}/sanidad-vegetal/labores" style="background: linear-gradient(135deg, #166534 0%, #22a35e 100%); color: #fff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 600; display: inline-block;">Ver evaluación</a>
          </td></tr></table>
        </div>
        <div style="background: #f9fafb; padding: 16px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; color: #9ca3af; font-size: 11px;">Este mensaje se generó automáticamente, por favor no respondas a este correo.</p>
        </div>
      </div>
    `;

    if (!isConfigured || !transporter) {
      console.log('═══════════════════════════════════════════════');
      console.log('📧  MAIL SERVICE (no configurado) — aviso de cargue de labor');
      console.log(`To:  ${destinatariosFinales.join(', ')}`);
      console.log(`Cc:  ${usaCcComoPrincipal ? '' : (cc || []).join(', ')}`);
      console.log(`Finca/Semana/Fecha: ${fincaNombre} / ${semanaCodigo} / ${fecha}`);
      console.log('═══════════════════════════════════════════════');
      return;
    }

    await transporter.sendMail({
      from: SMTP_FROM,
      to: destinatariosFinales,
      cc: !usaCcComoPrincipal && cc?.length ? cc : undefined,
      subject: `CORBANA — Nueva evaluación de labores: ${fincaNombre} (semana ${semanaCodigo})`,
      html,
    });
  },

  // Aviso de que una evaluación ya fue revisada — se manda a los mismos
  // destinatarios (rol revisor + CC configurados), con el PDF del
  // documento adjunto (generado en el navegador, ver
  // lib/visitaLaborExport.js#generarVisitaLaborPdfBlob — el backend no
  // genera PDFs, por eso llega ya armado desde el panel).
  async sendAvisoRevisionLabor({ destinatarios, cc, fincaNombre, semanaCodigo, fecha, revisadoPorNombre, pdfBuffer, pdfNombre }) {
    // Mismo criterio que sendAvisoCargueLabor: sin revisor que coincida
    // pero con CC configurado, el CC pasa a ser destinatario principal.
    const usaCcComoPrincipal = !destinatarios?.length && !!cc?.length;
    const destinatariosFinales = destinatarios?.length ? destinatarios : cc;
    if (!destinatariosFinales?.length) return;

    const html = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,.08);">
        <div style="background: linear-gradient(135deg, #166534 0%, #22a35e 100%); padding: 28px 32px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 22px; font-weight: 700;">CORBANA</h1>
          <p style="color: rgba(255,255,255,.85); margin: 4px 0 0; font-size: 13px;">Sanidad Vegetal — Evaluación de Labores</p>
        </div>
        <div style="padding: 32px;">
          <p style="margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.5;">Hola,</p>
          <p style="margin: 0 0 20px; color: #374151; font-size: 14px; line-height: 1.5;">
            La evaluación de labores de la finca <strong style="color: #166534;">${fincaNombre}</strong>,
            semana <strong>${semanaCodigo}</strong>, fecha <strong>${fecha}</strong>,
            fue revisada por <strong style="color: #166534;">${revisadoPorNombre}</strong>.
          </p>
          <p style="margin: 0 0 0; color: #374151; font-size: 14px; line-height: 1.5;">
            Adjunto encontrarás el documento en PDF.
          </p>
        </div>
        <div style="background: #f9fafb; padding: 16px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; color: #9ca3af; font-size: 11px;">Este mensaje se generó automáticamente, por favor no respondas a este correo.</p>
        </div>
      </div>
    `;

    if (!isConfigured || !transporter) {
      console.log('═══════════════════════════════════════════════');
      console.log('📧  MAIL SERVICE (no configurado) — aviso de revisión de labor');
      console.log(`To:  ${destinatariosFinales.join(', ')}`);
      console.log(`Cc:  ${usaCcComoPrincipal ? '' : (cc || []).join(', ')}`);
      console.log(`Revisado por: ${revisadoPorNombre}`);
      console.log(`Adjunto: ${pdfNombre} (${pdfBuffer?.length ?? 0} bytes)`);
      console.log('═══════════════════════════════════════════════');
      return;
    }

    await transporter.sendMail({
      from: SMTP_FROM,
      to: destinatariosFinales,
      cc: !usaCcComoPrincipal && cc?.length ? cc : undefined,
      subject: `CORBANA — Evaluación de labores revisada: ${fincaNombre} (semana ${semanaCodigo})`,
      html,
      attachments: pdfBuffer ? [{ filename: pdfNombre || 'visita.pdf', content: pdfBuffer, contentType: 'application/pdf' }] : [],
    });
  },

  // Resumen semanal de fincas en alerta (YLI bajo / Índice de Infección
  // alto) — se manda automáticamente al iniciar cada semana (cron) y
  // también puede dispararse a mano desde el botón "Enviar ahora" del panel.
  // `destinatarios` ya viene resuelto a emails reales (roles/usuarios ya
  // expandidos — ver evaluacion.service.js#resolverDestinatariosAlertas).
  async sendAlertasSemana({ destinatarios, semana, alertas }) {
    if (!destinatarios?.length) return;

    const filas = alertas
      .map(
        (a) => `
          <tr>
            <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #374151; font-size: 13px; font-weight: 600;">${a.fincaNombre}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #374151; font-size: 13px;">${a.promedioYli ?? '—'}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #374151; font-size: 13px;">${a.promedioIndice !== null ? `${a.promedioIndice}%` : '—'}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #b91c1c; font-size: 13px;">${a.motivos.map((m) => m.mensaje).join('<br/>')}</td>
          </tr>`,
      )
      .join('');

    const html = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,.08);">
        <div style="background: linear-gradient(135deg, #b45309 0%, #dc2626 100%); padding: 28px 32px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 22px; font-weight: 700;">CORBANA</h1>
          <p style="color: rgba(255,255,255,.9); margin: 4px 0 0; font-size: 13px;">Alertas de Sanidad Vegetal — Semana ${semana.codigo}</p>
        </div>
        <div style="padding: 32px;">
          <p style="margin: 0 0 20px; color: #374151; font-size: 14px; line-height: 1.5;">
            ${alertas.length} finca(s) superaron los umbrales de alerta (YLI por debajo de 8, Índice de
            Infección por encima de 33%, o Suma Bruta por Hoja por encima del umbral configurado) en la semana
            <strong>${semana.codigo}</strong> (${semana.fechaInicio} — ${semana.fechaFin}).
          </p>
          <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <thead>
              <tr style="background: #f9fafb;">
                <th style="padding: 8px 12px; text-align: left; color: #6b7280; font-size: 11px; text-transform: uppercase;">Finca</th>
                <th style="padding: 8px 12px; text-align: left; color: #6b7280; font-size: 11px; text-transform: uppercase;">YLI</th>
                <th style="padding: 8px 12px; text-align: left; color: #6b7280; font-size: 11px; text-transform: uppercase;">Índice</th>
                <th style="padding: 8px 12px; text-align: left; color: #6b7280; font-size: 11px; text-transform: uppercase;">Motivo</th>
              </tr>
            </thead>
            <tbody>${filas}</tbody>
          </table>
          <table role="presentation" style="width: 100%;"><tr><td align="center">
            <a href="${APP_URL}/sanidad-vegetal/alertas" style="background: linear-gradient(135deg, #b45309 0%, #dc2626 100%); color: #fff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 600; display: inline-block;">Ver alertas en el sistema</a>
          </td></tr></table>
        </div>
        <div style="background: #f9fafb; padding: 16px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; color: #9ca3af; font-size: 11px;">Este mensaje se generó automáticamente, por favor no respondas a este correo.</p>
        </div>
      </div>
    `;

    if (!isConfigured || !transporter) {
      console.log('═══════════════════════════════════════════════');
      console.log('📧  MAIL SERVICE (no configurado) — alertas de sanidad vegetal');
      console.log(`To:  ${destinatarios.join(', ')}`);
      console.log(`Semana: ${semana.codigo} — ${alertas.length} finca(s) en alerta`);
      console.log('═══════════════════════════════════════════════');
      return;
    }

    await transporter.sendMail({
      from: SMTP_FROM,
      to: destinatarios,
      subject: `CORBANA — Alertas de Sanidad Vegetal: ${alertas.length} finca(s) — semana ${semana.codigo} (enviado ${new Date().toISOString().slice(0, 10)})`,
      html,
    });
  },
};

export default mailService;
