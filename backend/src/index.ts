import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

import express from 'express';
import cors from 'cors';
import * as path from 'path';
import { initEmailTransport } from './services/email-transport';
import { pollStaleLeads, pollLostDeals, pollSatisfactionEmails } from './services/lifecycle-poller';
import leadsRoutes from './routes/leads.routes';
import dealsRoutes from './routes/deals.routes';
import tasksRoutes from './routes/tasks.routes';
import dashboardRoutes from './routes/dashboard.routes';
import companyRoutes from './routes/company.routes';
import emailsRoutes from './routes/emails.routes';
import invoicesRoutes from './routes/invoices.routes';
import settingsRoutes from './routes/settings.routes';
import { AppSettingsDB } from './database/db';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve uploaded files (logos, documents)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Initialize email transport
initEmailTransport();

// Routes
app.use('/api/leads', leadsRoutes);
app.use('/api/deals', dealsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/emails', emailsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/settings', settingsRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Workflow trigger endpoint
app.post('/api/workflow/start', async (req, res) => {
  try {
    const { leadId } = req.body;
    if (!leadId) {
      return res.status(400).json({ error: 'leadId is required' });
    }

    const { WorkflowEngine } = await import('./services/workflow-engine');
    const engine = new WorkflowEngine();
    const result = await engine.startWorkflow(leadId as string);

    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Workflow error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Auto-poll for customer replies on active deals ───
let polling = false;

async function pollForReplies() {
  if (polling) return;
  polling = true;

  try {
    const { getFirestore } = await import('./database/firebase');
    const snap = await getFirestore()
      .collection('deals')
      .where('status', 'in', ['lead_contacted', 'in_pipeline', 'offer_sent', 'proposal_sent', 'negotiating'])
      .get();

    const activeDeals = snap.docs.map(d => ({ id: d.id }));

    if (activeDeals.length === 0) {
      polling = false;
      return;
    }

    console.log(`\n📡 Auto-polling: checking ${activeDeals.length} active deal(s) for replies...`);

    const { WorkflowEngine } = await import('./services/workflow-engine');
    const engine = new WorkflowEngine();

    for (const deal of activeDeals) {
      try {
        const result = await engine.processReply(deal.id);
        if (result.status !== 'waiting') {
          console.log(`  📬 Deal #${deal.id}: ${result.message}`);
        }
      } catch (error: any) {
        console.error(`  ❌ Poll error for deal #${deal.id}:`, error.message);
      }
    }
  } catch (error: any) {
    console.error('Poll cycle error:', error.message);
  } finally {
    polling = false;
  }
}

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║  🇬🇷 Greek Business Agent Platform - API Server  ║
║  Running on http://localhost:${PORT}               ║
║                                                  ║
║  Agents:                                         ║
║  🎯 Marketing  💼 Sales  ⚖️  Legal               ║
║  📊 Accounting  📧 Email                         ║
║                                                  ║
║  📡 Auto-polling: replies/stale/lost/satisfaction ║
╚══════════════════════════════════════════════════╝
  `);

  // Start polling after a short delay to let server fully initialize
  setTimeout(async () => {
    const settings = await AppSettingsDB.get();
    const replyPollMs = settings.reply_poll_interval_minutes * 60 * 1000;
    console.log(`  📡 Reply poll interval: ${settings.reply_poll_interval_minutes} min`);
    setInterval(pollForReplies, replyPollMs);
    setInterval(pollStaleLeads, 6 * 3_600_000);      // every 6 hours
    setInterval(pollLostDeals, 24 * 3_600_000);      // every 24 hours
    setInterval(pollSatisfactionEmails, 24 * 3_600_000); // every 24 hours
    // Run lifecycle pollers once immediately on startup
    pollStaleLeads();
    pollLostDeals();
    pollSatisfactionEmails();
  }, 5_000);
});

export default app;
