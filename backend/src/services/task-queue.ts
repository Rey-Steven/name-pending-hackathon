import { TaskDB, Task } from '../database/db';
import { AgentType } from '../types';

export class TaskQueue {
  static async createTask(params: {
    sourceAgent: AgentType;
    targetAgent: AgentType;
    taskType: string;
    title: string;
    description?: string;
    inputData: any;
    dealId?: string;
    leadId?: string;
    priority?: number;
    companyId?: string;
  }): Promise<string> {
    const taskId = await TaskDB.create({
      company_id: params.companyId,
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

  static async startProcessing(taskId: string): Promise<void> {
    await TaskDB.update(taskId, { status: 'processing' });
  }

  static async complete(taskId: string, outputData?: any): Promise<void> {
    await TaskDB.update(taskId, {
      status: 'completed',
      output_data: outputData ? JSON.stringify(outputData) : undefined,
    });
  }

  static async fail(taskId: string, error: string): Promise<void> {
    await TaskDB.update(taskId, {
      status: 'failed',
      error_message: error,
    });
  }

  static async getPending(targetAgent: AgentType, companyId: string): Promise<Task[]> {
    return TaskDB.findPending(targetAgent, companyId);
  }

  static async getTaskWithData(taskId: string): Promise<(Task & { parsedInput: any }) | null> {
    const task = await TaskDB.findById(taskId);
    if (!task) return null;
    return {
      ...task,
      parsedInput: task.input_data ? JSON.parse(task.input_data) : null,
    };
  }
}
