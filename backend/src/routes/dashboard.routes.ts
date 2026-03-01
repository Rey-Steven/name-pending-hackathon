import { Router, Request, Response } from 'express';
import { AuditLog, CompanyProfileDB, DashboardStatsDB } from '../database/db';
import { SSEEvent } from '../types';
import { TaskLogger } from '../services/task-logger';

const router = Router();

// Store SSE clients for real-time updates
const sseClients: Set<Response> = new Set();

// GET /api/dashboard/stats - Dashboard statistics
// Uses count() aggregation for collections that only need counts (leads, tasks, emails, research, content)
// Only fetches full documents for deals and invoices (needed for value sums)
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).companyId || await CompanyProfileDB.getActiveId();
    if (!companyId) return res.status(400).json({ error: 'No active company' });
    const stats = await DashboardStatsDB.getStats(companyId);
    res.json(stats);
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
