import { MarketingAgent } from '../agents/marketing-agent';
import { SalesAgent } from '../agents/sales-agent';
import { LegalAgent } from '../agents/legal-agent';
import { AccountingAgent } from '../agents/accounting-agent';
import { EmailService } from '../agents/email-service';
import { TaskQueue } from './task-queue';
import { DealDB, AuditLog, CompanyProfileDB } from '../database/db';
import { broadcastEvent } from '../routes/dashboard.routes';
import { CompanyProfileContext } from '../types';

function loadCompanyProfile(): CompanyProfileContext | null {
  const raw = CompanyProfileDB.get();
  if (!raw) return null;
  try {
    const agentContexts = JSON.parse(raw.agent_context_json || '{}');
    return {
      id: raw.id!,
      name: raw.name,
      website: raw.website,
      logo_path: raw.logo_path,
      industry: raw.industry,
      description: raw.description,
      business_model: raw.business_model,
      target_customers: raw.target_customers,
      products_services: raw.products_services,
      geographic_focus: raw.geographic_focus,
      agentContexts,
    };
  } catch {
    return null;
  }
}

export class WorkflowEngine {
  // Start the full lead-to-invoice workflow
  async startWorkflow(leadId: number) {
    const startTime = Date.now();

    // Load company profile and instantiate agents with it
    const companyProfile = loadCompanyProfile();
    const marketingAgent = new MarketingAgent(companyProfile);
    const salesAgent = new SalesAgent(companyProfile);
    const legalAgent = new LegalAgent(companyProfile);
    const accountingAgent = new AccountingAgent(companyProfile);
    const emailService = new EmailService(companyProfile);

    console.log('\n' + '═'.repeat(60));
    console.log('  🚀 WORKFLOW STARTED - Lead-to-Invoice Automation');
    console.log('  📋 Lead ID:', leadId);
    if (companyProfile) {
      console.log(`  🏢 Company: ${companyProfile.name}`);
    }
    console.log('═'.repeat(60));

    AuditLog.log('workflow', 'workflow_started', 'lead', leadId, { leadId });

    try {
      // PHASE 1: Marketing Agent - Qualify the lead
      console.log('\n📍 PHASE 1: Marketing Agent');
      const marketingResult = await marketingAgent.processLead(leadId);

      // PHASE 2: Sales Agent - Close the deal
      console.log('\n📍 PHASE 2: Sales Agent');
      const { salesResult, dealId } = await salesAgent.processDeal(leadId, marketingResult.data);

      if (salesResult.data.qualification !== 'close' || !dealId) {
        console.log(`\n⚠️ Deal not closed: ${salesResult.data.qualification}`);
        broadcastEvent({
          type: 'workflow_completed',
          agent: 'sales',
          leadId,
          message: `Workflow ended - deal ${salesResult.data.qualification}`,
          timestamp: new Date().toISOString(),
        });
        return {
          status: salesResult.data.qualification,
          message: `Lead ${salesResult.data.qualification === 'nurture' ? 'moved to nurture' : 'rejected'}`,
          marketingResult: marketingResult.data,
          salesResult: salesResult.data,
        };
      }

      // PHASE 3 & 4 (Parallel): Legal Review + Accounting + Email
      console.log('\n📍 PHASE 3-5: Legal, Accounting & Email (parallel processing)');

      // Process pending tasks for each agent
      const pendingTasks = [
        ...TaskQueue.getPending('legal'),
        ...TaskQueue.getPending('accounting'),
        ...TaskQueue.getPending('email'),
      ];

      // Process all pending tasks
      for (const task of pendingTasks) {
        const taskData = TaskQueue.getTaskWithData(task.id!);
        if (!taskData) continue;

        TaskQueue.startProcessing(task.id!);

        try {
          switch (task.target_agent) {
            case 'legal':
              await legalAgent.reviewDeal(
                taskData.parsedInput.dealId,
                taskData.parsedInput.leadId,
                taskData.parsedInput.salesResult
              );
              break;

            case 'accounting':
              await accountingAgent.generateInvoice(
                taskData.parsedInput.dealId,
                taskData.parsedInput.leadId,
                taskData.parsedInput.salesResult
              );
              break;

            case 'email':
              await emailService.sendEmail(
                taskData.parsedInput.leadId,
                taskData.parsedInput.emailType || 'confirmation',
                {
                  dealId: taskData.parsedInput.dealId,
                  salesResult: taskData.parsedInput.salesResult,
                  invoiceData: taskData.parsedInput.invoiceData,
                  invoiceNumber: taskData.parsedInput.invoiceNumber,
                  invoiceId: taskData.parsedInput.invoiceId,
                }
              );
              break;
          }

          TaskQueue.complete(task.id!, { processed: true });
        } catch (error: any) {
          console.error(`  ❌ Task ${task.id} failed:`, error.message);
          TaskQueue.fail(task.id!, error.message);
        }
      }

      // Process any NEW email tasks created by accounting agent
      const newEmailTasks = TaskQueue.getPending('email');
      for (const task of newEmailTasks) {
        const taskData = TaskQueue.getTaskWithData(task.id!);
        if (!taskData) continue;

        TaskQueue.startProcessing(task.id!);

        try {
          await emailService.sendEmail(
            taskData.parsedInput.leadId,
            taskData.parsedInput.emailType || 'invoice',
            {
              dealId: taskData.parsedInput.dealId,
              invoiceData: taskData.parsedInput.invoiceData,
              invoiceNumber: taskData.parsedInput.invoiceNumber,
              invoiceId: taskData.parsedInput.invoiceId,
            }
          );
          TaskQueue.complete(task.id!, { processed: true });
        } catch (error: any) {
          console.error(`  ❌ Email task ${task.id} failed:`, error.message);
          TaskQueue.fail(task.id!, error.message);
        }
      }

      // Mark deal as completed
      DealDB.update(dealId, { status: 'completed' });

      const duration = Date.now() - startTime;

      console.log('\n' + '═'.repeat(60));
      console.log(`  ✅ WORKFLOW COMPLETED in ${(duration / 1000).toFixed(1)}s`);
      console.log(`  📋 Lead ${leadId} → Deal ${dealId}`);
      console.log('═'.repeat(60) + '\n');

      AuditLog.log('workflow', 'workflow_completed', 'deal', dealId, {
        leadId,
        dealId,
        duration,
      });

      broadcastEvent({
        type: 'workflow_completed',
        agent: 'sales',
        leadId,
        dealId,
        message: `Workflow completed in ${(duration / 1000).toFixed(1)}s - Deal #${dealId} closed`,
        timestamp: new Date().toISOString(),
      });

      return {
        status: 'completed',
        dealId,
        duration,
        message: `Full workflow completed in ${(duration / 1000).toFixed(1)}s`,
      };
    } catch (error: any) {
      console.error('\n❌ WORKFLOW FAILED:', error.message);

      AuditLog.log('workflow', 'workflow_failed', 'lead', leadId, { error: error.message });

      broadcastEvent({
        type: 'workflow_completed',
        agent: 'sales',
        leadId,
        message: `Workflow failed: ${error.message}`,
        timestamp: new Date().toISOString(),
      });

      throw error;
    }
  }
}
