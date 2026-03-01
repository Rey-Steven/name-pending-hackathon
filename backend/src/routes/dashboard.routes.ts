import { Router, Request, Response } from 'express';
import { LeadDB, DealDB, TaskDB, InvoiceDB, EmailDB, AuditLog, CompanyProfileDB, MarketResearchDB, SocialContentDB } from '../database/db';
import { SSEEvent } from '../types';
import { TaskLogger } from '../services/task-logger';

const router = Router();

// Store SSE clients for real-time updates
const sseClients: Set<Response> = new Set();

// GET /api/dashboard/stats - Dashboard statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).companyId || await CompanyProfileDB.getActiveId();
    if (!companyId) return res.status(400).json({ error: 'No active company' });
    const [leads, deals, tasks, invoices, emails, research, content] = await Promise.all([
      LeadDB.all(companyId),
      DealDB.all(companyId),
      TaskDB.all(companyId),
      InvoiceDB.all(companyId),
      EmailDB.all(companyId),
      MarketResearchDB.all(companyId),
      SocialContentDB.all(companyId),
    ]);

    const openDeals = deals.filter(d => ['lead_contacted', 'in_pipeline', 'offer_sent'].includes(d.status ?? ''));
    const wonDeals = deals.filter(d => d.status === 'closed_won');
    const lostDeals = deals.filter(d => d.status === 'closed_lost');
    const closedTotal = wonDeals.length + lostDeals.length;

    res.json({
      leads: {
        total: leads.length,
        new: leads.filter(l => l.status === 'new').length,
        qualified: leads.filter(l => l.status === 'qualified').length,
        converted: leads.filter(l => l.status === 'converted').length,
      },
      deals: {
        total: deals.length,
        open: openDeals.length,
        lead_contacted: deals.filter(d => d.status === 'lead_contacted').length,
        in_pipeline: deals.filter(d => d.status === 'in_pipeline').length,
        offer_sent: deals.filter(d => d.status === 'offer_sent').length,
        closed_won: wonDeals.length,
        closed_lost: lostDeals.length,
        pipelineValue: openDeals.reduce((sum, d) => sum + (d.total_amount || 0), 0),
        wonValue: wonDeals.reduce((sum, d) => sum + (d.total_amount || 0), 0),
        winRate: closedTotal > 0 ? Math.round((wonDeals.length / closedTotal) * 100) : null,
        totalValue: deals.reduce((sum, d) => sum + (d.total_amount || 0), 0),
        // legacy
        pending: deals.filter(d => d.status === 'pending').length,
        completed: deals.filter(d => d.status === 'completed').length,
      },
      tasks: {
        total: tasks.length,
        pending: tasks.filter(t => t.status === 'pending').length,
        processing: tasks.filter(t => t.status === 'processing').length,
        completed: tasks.filter(t => t.status === 'completed').length,
        failed: tasks.filter(t => t.status === 'failed').length,
      },
      invoices: {
        total: invoices.length,
        totalAmount: invoices.reduce((sum, i) => sum + (i.total_amount || 0), 0),
      },
      emails: {
        total: emails.length,
        sent: emails.filter(e => e.status === 'sent').length,
      },
      research: {
        total: research.length,
        completed: research.filter(r => r.status === 'completed').length,
        latestDate: research[0]?.created_at || null,
      },
      content: {
        total: content.length,
        drafts: content.filter(c => c.status === 'draft').length,
        approved: content.filter(c => c.status === 'approved').length,
        posted: content.filter(c => c.status === 'posted').length,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/dashboard/audit - Recent audit log
router.get('/audit', async (_req: Request, res: Response) => {
  try {
    const logs = await AuditLog.getRecent(100);
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/dashboard/events - SSE stream for real-time updates
router.get('/events', (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Send initial ping
  res.write('data: {"type":"connected","message":"Connected to event stream"}\n\n');

  sseClients.add(res);

  // Keep connection alive with heartbeat
  const heartbeat = setInterval(() => {
    res.write(':heartbeat\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

// Broadcast SSE event to all connected clients
export function broadcastEvent(event: SSEEvent) {
  const data = JSON.stringify(event);
  for (const client of sseClients) {
    client.write(`data: ${data}\n\n`);
  }

  // Persist log entry if this event is associated with a tracked task
  if (event.taskId && TaskLogger.has(event.taskId)) {
    TaskLogger.append(event.taskId, {
      type: event.type as any,
      agent: event.agent,
      message: event.message,
      reasoning: event.reasoning,
      data: event.data,
      timestamp: event.timestamp,
    });
  }
}

export default router;
