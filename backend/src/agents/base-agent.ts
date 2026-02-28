import { callAI, parseJSONResponse, ModelTier } from '../services/ai-service';
import { AuditLog } from '../database/db';
import { AgentType, AgentResponse } from '../types';
import { broadcastEvent } from '../routes/dashboard.routes';

export abstract class BaseAgent {
  readonly agentType: AgentType;
  readonly modelTier: ModelTier;

  constructor(agentType: AgentType, modelTier: ModelTier = 'sonnet') {
    this.agentType = agentType;
    this.modelTier = modelTier;
  }

  // Each agent defines its own system prompt
  abstract getSystemPrompt(): string;

  // Each agent builds the user prompt from its input data
  abstract buildUserPrompt(input: any): string;

  // Execute the agent: call AI, parse response, log everything
  async execute<T extends AgentResponse>(input: any, context?: { dealId?: number; leadId?: number; taskId?: number }): Promise<T> {
    const startTime = Date.now();

    console.log(`\n${'='.repeat(50)}`);
    console.log(`  🚀 ${this.agentType.toUpperCase()} AGENT starting...`);
    console.log(`${'='.repeat(50)}`);

    // Broadcast SSE: agent started
    broadcastEvent({
      type: 'agent_started',
      agent: this.agentType,
      taskId: context?.taskId,
      dealId: context?.dealId,
      leadId: context?.leadId,
      message: `${this.agentType} agent started processing`,
      timestamp: new Date().toISOString(),
    });

    // Log to audit
    AuditLog.log(this.agentType, 'agent_started', undefined, undefined, { input: typeof input === 'object' ? '...' : input });

    try {
      const systemPrompt = this.getSystemPrompt();
      const userPrompt = this.buildUserPrompt(input);

      // Call AI
      const response = await callAI(systemPrompt, userPrompt, this.modelTier);

      // Parse JSON response
      const result = parseJSONResponse<T>(response.content);

      const duration = Date.now() - startTime;

      // Log reasoning steps
      if (result.reasoning) {
        console.log(`\n  🧠 Agent reasoning:`);
        result.reasoning.forEach((step, i) => {
          console.log(`     ${i + 1}. ${step}`);
        });
      }
      console.log(`  📋 Decision: ${result.decision}`);
      console.log(`  ⏱️  Completed in ${duration}ms`);

      // Broadcast SSE: reasoning steps
      broadcastEvent({
        type: 'agent_reasoning',
        agent: this.agentType,
        taskId: context?.taskId,
        dealId: context?.dealId,
        leadId: context?.leadId,
        message: result.decision,
        reasoning: result.reasoning,
        data: result.data,
        timestamp: new Date().toISOString(),
      });

      // Broadcast SSE: completed
      broadcastEvent({
        type: 'agent_completed',
        agent: this.agentType,
        taskId: context?.taskId,
        dealId: context?.dealId,
        leadId: context?.leadId,
        message: `${this.agentType} agent completed: ${result.decision}`,
        reasoning: result.reasoning,
        data: result.data,
        timestamp: new Date().toISOString(),
      });

      // Audit log
      AuditLog.log(this.agentType, 'agent_completed', undefined, undefined, {
        decision: result.decision,
        duration,
        tokens: response.usage,
      });

      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;

      console.error(`  ❌ ${this.agentType} AGENT failed after ${duration}ms:`, error.message);

      // Broadcast SSE: failed
      broadcastEvent({
        type: 'agent_failed',
        agent: this.agentType,
        taskId: context?.taskId,
        dealId: context?.dealId,
        leadId: context?.leadId,
        message: `${this.agentType} agent failed: ${error.message}`,
        timestamp: new Date().toISOString(),
      });

      AuditLog.log(this.agentType, 'agent_failed', undefined, undefined, {
        error: error.message,
        duration,
      });

      throw error;
    }
  }
}
