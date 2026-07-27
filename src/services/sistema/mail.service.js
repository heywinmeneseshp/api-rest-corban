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
};

export default mailService;
