const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM   = process.env.MAIL_FROM   || 'Urbalert <noreply@urbalert.site>';
const FE_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ─── layout ──────────────────────────────────────────────────────────────────

function layout(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:8px;overflow:hidden;
                      box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#561C24;padding:28px 40px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;letter-spacing:1px;">
                🏙️ Urbalert
              </h1>
              <p style="margin:4px 0 0;color:#f0b8bc;font-size:13px;">
                Plataforma de reportes ciudadanos
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 28px;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9f9f9;padding:18px 40px;border-top:1px solid #eeeeee;">
              <p style="margin:0;font-size:12px;color:#999999;text-align:center;">
                Este correo fue enviado automáticamente por Urbalert. Por favor no respondas a este mensaje.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function btn(href, text) {
  return `<a href="${href}"
     style="display:inline-block;margin-top:24px;padding:13px 32px;
            background:#561C24;color:#ffffff;text-decoration:none;
            border-radius:6px;font-size:15px;font-weight:bold;">
    ${text}
  </a>`;
}

function note(text) {
  return `<p style="margin:20px 0 0;font-size:12px;color:#888888;">${text}</p>`;
}

// ─── sendVerificationEmail ────────────────────────────────────────────────────

async function sendVerificationEmail(to, nombre, token) {
  const link = `${FE_URL}/verify-email?token=${token}`;

  const body = `
    <h2 style="margin:0 0 8px;color:#561C24;font-size:20px;">Verifica tu correo electrónico</h2>
    <p style="margin:0 0 16px;color:#444444;font-size:15px;line-height:1.6;">
      Hola <strong>${nombre}</strong>, gracias por registrarte en Urbalert.
      Haz clic en el botón para confirmar tu dirección de correo y activar tu cuenta.
    </p>
    ${btn(link, 'Verificar mi correo')}
    <p style="margin:20px 0 0;font-size:14px;color:#666666;">
      O copia y pega este enlace en tu navegador:<br>
      <a href="${link}" style="color:#561C24;word-break:break-all;">${link}</a>
    </p>
    ${note('Este enlace expira en 24 horas. Si no creaste una cuenta en Urbalert, ignora este mensaje.')}
  `;

  return resend.emails.send({
    from:    FROM,
    to:      [to],
    subject: 'Verifica tu correo - Urbalert',
    html:    layout('Verificación de correo', body),
  });
}

// ─── sendPasswordReset ────────────────────────────────────────────────────────

async function sendPasswordReset(to, nombre, token) {
  const link = `${FE_URL}/reset-password?token=${token}`;

  const body = `
    <h2 style="margin:0 0 8px;color:#561C24;font-size:20px;">Recupera tu contraseña</h2>
    <p style="margin:0 0 16px;color:#444444;font-size:15px;line-height:1.6;">
      Hola <strong>${nombre}</strong>, recibimos una solicitud para restablecer
      la contraseña de tu cuenta en Urbalert.
    </p>
    ${btn(link, 'Restablecer contraseña')}
    <p style="margin:20px 0 0;font-size:14px;color:#666666;">
      O copia y pega este enlace en tu navegador:<br>
      <a href="${link}" style="color:#561C24;word-break:break-all;">${link}</a>
    </p>
    ${note('Este enlace expira en 1 hora. Si no solicitaste este cambio, ignora este mensaje — tu contraseña no será modificada.')}
  `;

  return resend.emails.send({
    from:    FROM,
    to:      [to],
    subject: 'Recupera tu contraseña - Urbalert',
    html:    layout('Recuperación de contraseña', body),
  });
}

// ─── sendWelcomeAuthority ─────────────────────────────────────────────────────

async function sendWelcomeAuthority(to, nombre, password_temporal) {
  const loginUrl = `${FE_URL}/login`;

  const body = `
    <h2 style="margin:0 0 8px;color:#561C24;font-size:20px;">¡Bienvenido/a a Urbalert!</h2>
    <p style="margin:0 0 16px;color:#444444;font-size:15px;line-height:1.6;">
      Hola <strong>${nombre}</strong>, tu cuenta de autoridad ha sido creada en la
      plataforma Urbalert. A continuación encontrarás tus credenciales de acceso:
    </p>

    <table cellpadding="0" cellspacing="0"
           style="background:#fdf3f4;border-left:4px solid #561C24;
                  border-radius:4px;padding:16px 20px;margin:8px 0;">
      <tr>
        <td style="font-size:14px;color:#444444;padding:4px 0;">
          <strong style="color:#561C24;">Correo:</strong>&nbsp; ${to}
        </td>
      </tr>
      <tr>
        <td style="font-size:14px;color:#444444;padding:4px 0;">
          <strong style="color:#561C24;">Contraseña temporal:</strong>&nbsp;
          <code style="background:#eeeeee;padding:2px 6px;border-radius:3px;
                       font-size:14px;">${password_temporal}</code>
        </td>
      </tr>
    </table>

    <p style="margin:16px 0;color:#444444;font-size:14px;line-height:1.6;">
      Por seguridad, deberás cambiar tu contraseña la primera vez que inicies sesión.
    </p>
    ${btn(loginUrl, 'Iniciar sesión')}
    ${note('Si tienes algún problema para acceder, contacta al administrador de Urbalert.')}
  `;

  return resend.emails.send({
    from:    FROM,
    to:      [to],
    subject: 'Bienvenido a Urbalert',
    html:    layout('Bienvenido a Urbalert', body),
  });
}

// ─── sendVerificationCode ─────────────────────────────────────────────────────

async function sendVerificationCode(to, nombre, codigo) {
  const body = `
    <h2 style="margin:0 0 8px;color:#561C24;font-size:20px;">Verifica tu correo electrónico</h2>
    <p style="margin:0 0 24px;color:#444444;font-size:15px;line-height:1.6;">
      Hola <strong>${nombre}</strong>, gracias por registrarte en Urbalert.
      Usa el siguiente código para verificar tu dirección de correo:
    </p>

    <div style="text-align:center;margin:0 0 24px;">
      <span style="display:inline-block;background:#fdf3f4;border:2px solid #561C24;
                   border-radius:10px;padding:18px 40px;
                   font-size:40px;font-weight:900;letter-spacing:10px;
                   color:#561C24;font-family:monospace;">
        ${codigo}
      </span>
    </div>

    ${note('Este código expira en 15 minutos. Si no creaste una cuenta en Urbalert, ignora este mensaje.')}
  `;

  return resend.emails.send({
    from:    FROM,
    to:      [to],
    subject: 'Tu código de verificación - Urbalert',
    html:    layout('Verificación de correo', body),
  });
}

// ─── exports ──────────────────────────────────────────────────────────────────

module.exports = { sendVerificationEmail, sendVerificationCode, sendPasswordReset, sendWelcomeAuthority };
