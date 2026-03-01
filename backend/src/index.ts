import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

import express from 'express';
import cors from 'cors';
import * as path from 'path';
import { initEmailTransport } from './services/email-transport';
import { pollStaleLeads, pollLostDeals, pollSatisfactionEmails, pollMarketResearch, pollContentCreation, pollStaleTasks, pollElorusAcceptedEstimates } from './services/lifecycle-poller';
import leadsRoutes from './routes/leads.routes';
import dealsRoutes from './routes/deals.routes';
import tasksRoutes from './routes/tasks.routes';
import dashboardRoutes from './routes/dashboard.routes';
import companyRoutes from './routes/company.routes';
import emailsRoutes from './routes/emails.routes';
import invoicesRoutes from './routes/invoices.routes';
import settingsRoutes from './routes/settings.routes';
import { AppSettingsDB, DealDB, CompanyProfileDB } from './database/db';
import researchRoutes from './routes/research.routes';
import contentRoutes from './routes/content.routes';
import gemiRoutes from './routes/gemi.routes';
import elorusRoutes from './routes/elorus.routes';
import { pollGemiScraper } from './services/gemi-scraper';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Extract company ID from frontend header so each request is pinned to the
// company the UI intended, avoiding race conditions during company switching.
app.use('/api', (req, _res, next) => {
  const companyId = req.headers['x-company-id'];
  if (typeof companyId === 'string' && companyId) {
    (req as any).companyId = companyId;
  }
  next();
});

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
app.use('/api/research', researchRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/gemi', gemiRoutes);
app.use('/api/elorus', elorusRoutes);

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
    const REPLY_STATUSES = ['lead_contacted', 'in_pipeline', 'offer_sent', 'proposal_sent', 'negotiating'];
    const companies = await CompanyProfileDB.getAll();
    const allActiveDeals: { id: string }[] = [];
    for (const company of companies) {
      const deals = await DealDB.findByStatus(REPLY_STATUSES, company.id!);
      allActiveDeals.push(...deals.map(d => ({ id: d.id! })));
    }

    const activeDeals = allActiveDeals;

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
║  📡 Auto-polling: replies/stale/lost/research     ║
╚══════════════════════════════════════════════════╝
  `);

  // Start polling after a short delay to let server fully initialize
  setTimeout(async () => {
    const settings = await AppSettingsDB.get();
    const replyPollMs = settings.reply_poll_interval_minutes * 60 * 1000;
    console.log(`  📡 Reply poll interval: ${settings.reply_poll_interval_minutes} min`);
    setInterval(pollForReplies, replyPollMs);
    setInterval(pollElorusAcceptedEstimates, replyPollMs); // same cadence as reply polling
    setInterval(pollStaleTasks, 5 * 60_000);              // every 5 minutes
    setInterval(pollStaleLeads, 6 * 3_600_000);            // every 6 hours
    setInterval(pollLostDeals, 24 * 3_600_000);            // every 24 hours
    setInterval(pollSatisfactionEmails, 24 * 3_600_000);   // every 24 hours
    setInterval(pollMarketResearch, 24 * 3_600_000);       // every 24 hours
    setInterval(pollContentCreation, 24 * 3_600_000);      // every 24 hours
    setInterval(pollGemiScraper, 24 * 3_600_000);          // every 24 hours
    // Run lifecycle pollers once immediately on startup
    pollElorusAcceptedEstimates();
    pollStaleTasks();
    pollStaleLeads();
    pollLostDeals();
    pollSatisfactionEmails();
    pollMarketResearch();
    // Delay content creation to give research time to complete
    setTimeout(pollContentCreation, 5 * 60_000);
    // Start GEMI scraper
    pollGemiScraper();
  }, 5_000);
});

export default app;
