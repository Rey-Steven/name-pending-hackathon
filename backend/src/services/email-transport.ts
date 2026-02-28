import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

export function initEmailTransport() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    console.warn('  ⚠️  GMAIL_USER or GMAIL_APP_PASSWORD not set - emails will be logged only');
    return;
  }

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  console.log(`  📧 Email transport ready (sending from ${user})`);
}

export async function sendRealEmail(params: {
  to: string;
  subject: string;
  body: string;
  replyTo?: string;
}): Promise<{ sent: boolean; messageId?: string; error?: string }> {
  const fromUser = process.env.GMAIL_USER;

  if (!transporter || !fromUser) {
    console.log(`  📧 [LOG ONLY] To: ${params.to}`);
    console.log(`     Subject: ${params.subject}`);
    console.log(`     Body: ${params.body.slice(0, 200)}...`);
    return { sent: false, error: 'No email transport configured' };
  }

  try {
    const info = await transporter.sendMail({
      from: `"AgentFlow 🇬🇷" <${fromUser}>`,
      to: params.to,
      subject: params.subject,
      text: params.body,
      html: formatEmailHTML(params.subject, params.body),
      replyTo: params.replyTo || fromUser,
    });

    console.log(`  📧 ✅ Email SENT to ${params.to} (ID: ${info.messageId})`);
    return { sent: true, messageId: info.messageId };
  } catch (error: any) {
    console.error(`  📧 ❌ Email FAILED to ${params.to}: ${error.message}`);
    return { sent: false, error: error.message };
  }
}

function formatEmailHTML(subject: string, body: string): string {
  // Convert plain text body to simple HTML email
  const htmlBody = body
    .split('\n')
    .map(line => {
      if (line.trim() === '') return '<br>';
      return `<p style="margin:0 0 8px 0;line-height:1.5">${line}</p>`;
    })
    .join('\n');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333">
  <div style="border-bottom:3px solid #3b82f6;padding-bottom:16px;margin-bottom:24px">
    <h2 style="margin:0;color:#1e3a5f">🇬🇷 AgentFlow</h2>
    <p style="margin:4px 0 0;color:#666;font-size:13px">Zero Human Company - Automated Business Platform</p>
  </div>

  <div style="margin-bottom:24px">
    ${htmlBody}
  </div>

  <div style="border-top:1px solid #e5e7eb;padding-top:16px;margin-top:24px;font-size:12px;color:#9ca3af">
    <p>This email was generated and sent automatically by AgentFlow AI agents.</p>
    <p>🎯 Marketing &middot; 💼 Sales &middot; ⚖️ Legal &middot; 📊 Accounting &middot; 📧 Email</p>
  </div>
</body>
</html>`;
}
