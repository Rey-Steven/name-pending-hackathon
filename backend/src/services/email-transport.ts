import nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { EmailDB } from '../database/db';

let transporter: nodemailer.Transporter | null = null;

// ─── SMTP (Sending) ───────────────────────────────────────

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
  console.log(`  📥 IMAP reader ready (reading inbox for ${user})`);
}

export async function sendRealEmail(params: {
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
  attachments?: Array<{ filename: string; content: Buffer }>;
}): Promise<{ sent: boolean; messageId?: string; error?: string }> {
  const fromUser = process.env.GMAIL_USER;

  if (!transporter || !fromUser) {
    console.log(`  📧 [LOG ONLY] To: ${params.to}`);
    console.log(`     Subject: ${params.subject}`);
    console.log(`     Body: ${params.body.slice(0, 200)}...`);
    return { sent: false, error: 'No email transport configured' };
  }

  try {
    const mailOptions: nodemailer.SendMailOptions = {
      from: `"AgentFlow Demo" <${fromUser}>`,
      to: params.to,
      subject: params.subject,
      text: params.body,
      html: formatEmailHTML(params.subject, params.body),
      replyTo: fromUser,
      attachments: params.attachments?.map(a => ({
        filename: a.filename,
        content: a.content,
      })),
    };

    // Thread replies together
    if (params.inReplyTo) {
      mailOptions.inReplyTo = params.inReplyTo;
      mailOptions.references = params.references || params.inReplyTo;
    }

    const info = await transporter.sendMail(mailOptions);

    console.log(`  📧 ✅ Email SENT to ${params.to} (ID: ${info.messageId})`);
    return { sent: true, messageId: info.messageId };
  } catch (error: any) {
    console.error(`  📧 ❌ Email FAILED to ${params.to}: ${error.message}`);
    return { sent: false, error: error.message };
  }
}

// ─── IMAP (Reading) ───────────────────────────────────────

function getImapClient(): ImapFlow | null {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) return null;

  return new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  });
}

export interface InboxEmail {
  uid: number;
  messageId: string;
  from: string;
  fromName: string;
  to: string;
  subject: string;
  body: string;
  date: string;
  inReplyTo?: string;
  references?: string;
  isReply: boolean;
  seen: boolean;
}

// Helper to parse a single IMAP message into InboxEmail
async function parseMessage(message: any): Promise<InboxEmail | null> {
  try {
    if (!message.source) return null;
    const parsed: any = await simpleParser(message.source);

    const fromAddr = parsed.from?.value?.[0];
    const inReplyTo = parsed.inReplyTo || '';
    const references = Array.isArray(parsed.references)
      ? parsed.references.join(' ')
      : (parsed.references || '');

    const toField = parsed.to;
    let toStr = '';
    if (toField) {
      if (Array.isArray(toField)) {
        toStr = toField.map((t: any) => t.text).join(', ');
      } else {
        toStr = toField.text || '';
      }
    }

    return {
      uid: message.uid,
      messageId: parsed.messageId || '',
      from: fromAddr?.address || '',
      fromName: fromAddr?.name || fromAddr?.address || '',
      to: toStr,
      subject: parsed.subject || '',
      body: parsed.text || '',
      date: parsed.date?.toISOString() || '',
      inReplyTo,
      references,
      isReply: !!inReplyTo,
      seen: message.flags?.has('\\Seen') || false,
    };
  } catch {
    return null;
  }
}

// Fetch recent emails from inbox
export async function fetchInbox(limit: number = 20): Promise<InboxEmail[]> {
  const client = getImapClient();
  if (!client) return [];

  const emails: InboxEmail[] = [];

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');

    try {
      const mailbox = client.mailbox;
      const totalMessages = mailbox && typeof mailbox === 'object' && 'exists' in mailbox
        ? (mailbox as any).exists as number
        : 0;
      if (totalMessages === 0) return [];

      const startSeq = Math.max(1, totalMessages - limit + 1);
      const range = `${startSeq}:*`;

      for await (const message of client.fetch(range, {
        envelope: true,
        source: true,
        flags: true,
      })) {
        const email = await parseMessage(message);
        if (email) emails.push(email);
      }
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (error: any) {
    console.error(`  📥 IMAP error: ${error.message}`);
    try { await client.logout(); } catch {}
  }

  // Newest first
  return emails.reverse();
}

// Fetch only unread emails
export async function fetchUnread(): Promise<InboxEmail[]> {
  const client = getImapClient();
  if (!client) return [];

  const emails: InboxEmail[] = [];

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');

    try {
      const searchResult = await client.search({ seen: false });
      const uids = Array.isArray(searchResult) ? searchResult : [];

      if (uids.length === 0) {
        lock.release();
        await client.logout();
        return [];
      }

      for await (const message of client.fetch(uids, {
        envelope: true,
        source: true,
        flags: true,
        uid: true,
      })) {
        const email = await parseMessage(message);
        if (email) {
          email.seen = false;
          emails.push(email);
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (error: any) {
    console.error(`  📥 IMAP error: ${error.message}`);
    try { await client.logout(); } catch {}
  }

  return emails.reverse();
}

// Match inbox replies to our sent emails
export async function fetchReplies(): Promise<Array<InboxEmail & { matchedEmailId?: string; matchedDealId?: string | null }>> {
  const inbox = await fetchInbox(50);

  // Get all sent emails from our database
  const sentEmails = await EmailDB.findSent();

  const gmailUser = process.env.GMAIL_USER || '';

  // Filter to only replies (not from us)
  const replies = inbox
    .filter(e => e.from !== gmailUser && e.isReply)
    .map(email => {
      // Try to match to a sent email by subject similarity
      const matchedSent = sentEmails.find(sent => {
        const reSubject = email.subject.replace(/^(Re|RE|Fwd|FWD|Απ|ΑΠ|Πρ):\s*/g, '').trim();
        const sentSubject = sent.subject.replace(/^(Re|RE|Fwd|FWD|Απ|ΑΠ|Πρ):\s*/g, '').trim();
        return reSubject === sentSubject || email.from === sent.recipient_email;
      });

      return {
        ...email,
        matchedEmailId: matchedSent?.id,
        matchedDealId: matchedSent?.deal_id,
      };
    });

  return replies;
}

// Fetch the most recent reply for a specific deal
export async function fetchRepliesForDeal(dealId: string): Promise<InboxEmail | null> {
  // Get all sent emails for this deal
  const sentEmails = await EmailDB.findSentByDeal(dealId);

  if (sentEmails.length === 0) return null;

  const inbox = await fetchInbox(50);
  const gmailUser = process.env.GMAIL_USER || '';

  // Get the most recent sent email timestamp to only look for newer replies
  const lastSentTime = new Date(sentEmails[0].created_at).getTime();

  // Find replies from the deal's recipient
  const recipientEmails = [...new Set(sentEmails.map(e => e.recipient_email))];
  const sentSubjects = sentEmails.map(e =>
    e.subject.replace(/^(Re|RE|Fwd|FWD|Απ|ΑΠ|Πρ):\s*/g, '').trim()
  );

  const matchingReplies = inbox.filter(email => {
    // Must not be from us
    if (email.from === gmailUser) return false;

    // Must be from the deal's recipient
    const fromRecipient = recipientEmails.includes(email.from);

    // Check subject match
    const cleanSubject = email.subject.replace(/^(Re|RE|Fwd|FWD|Απ|ΑΠ|Πρ):\s*/g, '').trim();
    const subjectMatch = sentSubjects.some(s => cleanSubject === s);

    // Must be newer than our last sent email
    const emailTime = new Date(email.date).getTime();
    const isNewer = emailTime > lastSentTime;

    return (fromRecipient || subjectMatch) && isNewer;
  });

  // Return the most recent matching reply
  return matchingReplies.length > 0 ? matchingReplies[0] : null;
}

// ─── HTML Formatting ──────────────────────────────────────

function formatEmailHTML(subject: string, body: string): string {
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
