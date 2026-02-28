import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

import express from 'express';
import cors from 'cors';
import * as path from 'path';
import { initializeDatabase } from './database/db';
import { initEmailTransport } from './services/email-transport';
import leadsRoutes from './routes/leads.routes';
import dealsRoutes from './routes/deals.routes';
import tasksRoutes from './routes/tasks.routes';
import dashboardRoutes from './routes/dashboard.routes';
import companyRoutes from './routes/company.routes';
import emailsRoutes from './routes/emails.routes';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve uploaded files (logos, documents)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Initialize database
initializeDatabase();

// Initialize email transport
initEmailTransport();

// Routes
app.use('/api/leads', leadsRoutes);
app.use('/api/deals', dealsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/emails', emailsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/company', companyRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Workflow trigger endpoint - will be wired to workflow engine later
app.post('/api/workflow/start', async (req, res) => {
  try {
    const { leadId } = req.body;
    if (!leadId) {
      return res.status(400).json({ error: 'leadId is required' });
    }

    // Import workflow engine (lazy import to avoid circular deps)
    const { WorkflowEngine } = await import('./services/workflow-engine');
    const engine = new WorkflowEngine();
    const result = await engine.startWorkflow(leadId);

    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Workflow error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║  🇬🇷 Greek Business Agent Platform - API Server  ║
║  Running on http://localhost:${PORT}               ║
║                                                  ║
║  Agents:                                         ║
║  🎯 Marketing  💼 Sales  ⚖️  Legal               ║
║  📊 Accounting  📧 Email                         ║
╚══════════════════════════════════════════════════╝
  `);
});

export default app;
