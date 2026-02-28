import { TaskDB, Task } from '../database/db';
import { AgentType } from '../types';

// Simple in-memory task queue (no Redis needed for hackathon)
// Tasks are stored in SQLite and processed immediately

export class TaskQueue {
  // Create a new task and queue it for processing
  static createTask(params: {
    sourceAgent: AgentType;
    targetAgent: AgentType;
    taskType: string;
    title: string;
    description?: string;
    inputData: any;
    dealId?: number;
    leadId?: number;
    priority?: number;
  }): number {
    const taskId = TaskDB.create({
      source_agent: params.sourceAgent,
      target_agent: params.targetAgent,
      task_type: params.taskType,
      title: params.title,
      description: params.description,
      input_data: JSON.stringify(params.inputData),
      deal_id: params.dealId,
      lead_id: params.leadId,
      priority: params.priority || 0,
    });

    console.log(`  📝 Task created: [${params.sourceAgent} → ${params.targetAgent}] ${params.title} (ID: ${taskId})`);
    return taskId;
  }

  // Mark task as processing
  static startProcessing(taskId: number) {
    TaskDB.update(taskId, { status: 'processing' });
  }

  // Mark task as completed
  static complete(taskId: number, outputData?: any) {
    TaskDB.update(taskId, {
      status: 'completed',
      output_data: outputData ? JSON.stringify(outputData) : undefined,
    });
  }

  // Mark task as failed
  static fail(taskId: number, error: string) {
    TaskDB.update(taskId, {
      status: 'failed',
      error_message: error,
    });
  }

  // Get pending tasks for an agent
  static getPending(targetAgent: AgentType): Task[] {
    return TaskDB.findPending(targetAgent);
  }

  // Get task with parsed input data
  static getTaskWithData(taskId: number): (Task & { parsedInput: any }) | null {
    const task = TaskDB.findById(taskId);
    if (!task) return null;
    return {
      ...task,
      parsedInput: task.input_data ? JSON.parse(task.input_data) : null,
    };
  }
}
