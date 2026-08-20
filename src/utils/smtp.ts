import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn('[SMTP] Not configured — skipping emails. Missing:', {
      host: !!host, user: !!user, pass: !!pass
    });
    return null;
  }

  console.log(`[SMTP] Configuring transporter: ${host}:${port} user=${user}`);
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return transporter;
}

interface EmailParams {
  userName: string;
  title: string;
  message: string;
  buttonText: string;
  buttonUrl: string;
  details?: { label: string; value: string }[];
  footer?: string;
}

export function emailTemplate({ userName, title, message, buttonText, buttonUrl, details, footer }: EmailParams): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#F7F7F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F7F5;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <!-- Header -->
        <tr><td style="background-color:#37352F;padding:24px 32px;border-radius:12px 12px 0 0;">
          <h1 style="margin:0;color:#FFFFFF;font-size:18px;font-weight:700;letter-spacing:-0.3px;">Iceberg Agency</h1>
          <p style="margin:4px 0 0;color:#91918E;font-size:12px;">CRM & Project Management</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="background-color:#FFFFFF;padding:32px;border:1px solid #EDEDEB;border-top:none;">
          <p style="margin:0 0 16px;color:#5A5A57;font-size:14px;">Hola <strong style="color:#37352F;">${userName}</strong>,</p>
          <h2 style="margin:0 0 20px;color:#37352F;font-size:20px;font-weight:700;letter-spacing:-0.5px;">${title}</h2>
          <div style="background-color:#F7F7F5;border-left:4px solid #2383E2;padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:24px;">
            <p style="margin:0;color:#37352F;font-size:14px;line-height:1.6;">${message}</p>
          </div>
          ${details && details.length > 0 ? `
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            ${details.map(d => `
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #EDEDEB;color:#91918E;font-size:12px;width:120px;vertical-align:top;">${d.label}</td>
              <td style="padding:8px 0;border-bottom:1px solid #EDEDEB;color:#37352F;font-size:13px;font-weight:500;">${d.value}</td>
            </tr>`).join('')}
          </table>` : ''}
          <!-- Button -->
          <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
            <tr><td style="background-color:#2383E2;border-radius:8px;padding:12px 32px;">
              <a href="${buttonUrl}" style="color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;display:inline-block;letter-spacing:-0.2px;">${buttonText}</a>
            </td></tr>
          </table>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background-color:#F7F7F5;padding:20px 32px;border:1px solid #EDEDEB;border-top:none;border-radius:0 0 12px 12px;">
          <p style="margin:0;color:#91918E;font-size:11px;text-align:center;">
            ${footer || 'Este correo fue enviado automáticamente por el sistema CRM de Iceberg Agency.'}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendEmail(to: string, subject: string, html: string) {
  const t = getTransporter();
  if (!t) return;

  const fromName = process.env.SMTP_FROM_NAME || 'Iceberg Agency';
  const fromEmail = process.env.SMTP_FROM_EMAIL || 'noreply@nextboostperu.com';

  try {
    const info = await t.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      html,
    });
    console.log(`[SMTP] Email sent to ${to}: ${info.messageId}`);
  } catch (err: any) {
    console.error(`[SMTP] Failed to send to ${to}:`, err.message || err);
    throw err;
  }
}
