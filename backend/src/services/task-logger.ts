export interface TaskLogEntry {
  type: 'agent_started' | 'agent_reasoning' | 'agent_completed' | 'agent_failed' | 'info' | 'warning';
  agent: string;
  message: string;
  reasoning?: string[];
  data?: Record<string, any>;
  timestamp: string;
}

const taskLogs = new Map<string, TaskLogEntry[]>();

export const TaskLogger = {
  init(taskId: string): void {
    taskLogs.set(taskId, []);
  },

  append(taskId: string, entry: TaskLogEntry): void {
    const logs = taskLogs.get(taskId);
    if (logs) {
      logs.push(entry);
    }
  },

  flush(taskId: string): TaskLogEntry[] {
    const logs = taskLogs.get(taskId) || [];
    taskLogs.delete(taskId);
    return logs;
  },

  has(taskId: string): boolean {
    return taskLogs.has(taskId);
  },
};
