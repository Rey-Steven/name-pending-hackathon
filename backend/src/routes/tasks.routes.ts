import { Router, Request, Response } from 'express';
import { TaskDB } from '../database/db';

const router = Router();

// GET /api/tasks - Get all tasks
router.get('/', async (_req: Request, res: Response) => {
  try {
    const tasks = await TaskDB.all();
    res.json(tasks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/tasks/:id - Get task by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const task = await TaskDB.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/tasks/agent/:agentType - Get pending tasks for an agent
router.get('/agent/:agentType', async (req: Request, res: Response) => {
  try {
    const tasks = await TaskDB.findPending(req.params.agentType);
    res.json(tasks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
