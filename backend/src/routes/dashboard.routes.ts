import { Router, Request, Response } from 'express';
import { LeadDB, DealDB, TaskDB, InvoiceDB, EmailDB, AuditLog, CompanyProfileDB } from '../database/db';
import { SSEEvent } from '../types';

const router = Router();

// Store SSE clients for real-time updates
const sseClients: Set<Response> = new Set();

// GET /api/dashboard/stats - Dashboard statistics
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const companyId = await CompanyProfileDB.getActiveId();
    if (!companyId) return res.status(400).json({ error: 'No active company' });
    const [leads, deals, tasks, invoices, emails] = await Promise.all([
      LeadDB.all(companyId),
      DealDB.all(companyId),
      TaskDB.all(companyId),
      InvoiceDB.all(companyId),
      EmailDB.all(companyId),
    ]);

    res.json({
      leads: {
        total: leads.length,
        new: leads.filter(l => l.status === 'new').length,
        qualified: leads.filter(l => l.status === 'qualified').length,
        converted: leads.filter(l => l.status === 'converted').length,
      },
      deals: {
        total: deals.length,
        pending: deals.filter(d => d.status === 'pending').length,
        completed: deals.filter(d => d.status === 'completed').length,
        totalValue: deals.reduce((sum, d) => sum + (d.total_amount || 0), 0),
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
}

export default router;
