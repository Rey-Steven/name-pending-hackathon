# Multi-Agent SaaS Tool - Minimal MVP Implementation Plan

## Context

This plan implements a proof-of-concept multi-agent SaaS tool where AI agents can communicate and coordinate tasks with each other through a centralized task list.

**Problem Being Solved:**
- Businesses need automated workflow coordination between different departments
- Agents should work autonomously but coordinate through a shared task management system
- Each agent should be able to create tasks for other agents to execute
- Tasks should clearly show which department they're for and where they originated from

**User Workflow:**
1. User creates a company profile (name + website URL or detailed description)
2. AI agent researches the company (scrapes website or analyzes description)
3. User configures sales settings (what products/services to sell)
4. Sales agent operates and creates tasks for other departments (e.g., accounting)
5. Other agents pick up tasks from the shared task list and execute them

**User Requirements:**
- AI Provider: Anthropic Claude
- Scope: Minimal MVP (~1 week)
- Frontend: Vue 3 (not Next.js)
- Agent Types: Start with Sales and Accounting (extensible for future agents)
- Auth: Simple Google login

## Architecture Overview

### Core Pattern: Company Onboarding + Task Queue + Agent Processors

```
User Creates Company → AI Researches → User Configures Sales → Sales Agent Runs
        ↓                    ↓                   ↓                      ↓
   (DB Record)          (Claude AI)          (Settings)         Creates Tasks
                                                                       ↓
                                                            Task List (Database)
                                                                       ↓
                                                  Accounting Agent Processes Task
                                                            ↓
                                                      (Claude AI)
```

### Technology Stack

**Backend:**
- **Node.js + TypeScript + Express** - Simple REST API (no NestJS complexity for MVP)
- **Firebase Firestore** - NoSQL database with real-time updates, no migrations
- **Firebase Auth** - Built-in Google authentication (5-minute setup)
- **BullMQ + Redis** - Reliable task queue with retry logic for agent processing
- **Anthropic SDK** - Claude API for agent intelligence

**Frontend:**
- **Vue 3 + Vite** - Modern, reactive frontend framework
- **Vue Router** - Client-side routing
- **Pinia** - State management
- **Tailwind CSS** - Rapid UI development
- **Auth**: Simple Google OAuth (handled by backend)

**Infrastructure (Local Dev):**
- **Docker Compose** - Redis only (for BullMQ)
- **Firebase Project** - Firestore + Auth (cloud-hosted, no local setup)

**Why This Hybrid Stack?**

✅ **Firebase Benefits:**
- **Zero database setup** - No Docker container, no migrations, works immediately
- **Real-time by default** - Built-in live updates for task list (better than polling)
- **5-minute auth** - Google sign-in is literally 3 clicks to enable
- **Free tier is generous** - Perfect for MVP and small projects
- **Automatic backups** - No need to manage database backups

✅ **Keep BullMQ Benefits:**
- **Reliable task processing** - Retries, error handling, priority queues
- **Proven pattern** - Industry-standard for job queues
- **Agent isolation** - Workers can crash without affecting API
- **Only one Docker container** - Just Redis, much lighter than PostgreSQL + Redis

✅ **Best of Both Worlds:**
- Fast development (Firebase) + Production-ready queue (BullMQ)
- Can scale Firestore and BullMQ independently
- If needed, can migrate away from Firebase later (Firestore → PostgreSQL)

### Agent Communication Flow

```typescript
// 1. Sales Agent processes a sale
SalesAgent.closeDeal(dealData)
  ↓
// 2. Creates task in database
Task.create({
  type: 'GENERATE_INVOICE',
  sourceAgent: 'SALES',
  targetAgent: 'ACCOUNTING',
  data: { dealId, customerId, amount }
})
  ↓
// 3. Queues task in BullMQ
TaskQueue.add('accounting', task)
  ↓
// 4. Accounting worker picks up task
AccountingWorker.process((job) => {
  AccountingAgent.generateInvoice(job.data)
})
  ↓
// 5. Updates task status to completed
Task.update(taskId, { status: 'COMPLETED', result: invoice })
```

## Implementation Steps

### Step 1: Project Setup (1-2 hours)

**Initialize Monorepo:**
```bash
# Use PNPM workspace
mkdir name-pending-hackathon && cd name-pending-hackathon
pnpm init
```

**Create workspace structure:**
```
name-pending-hackathon/
├── apps/
│   ├── api/          # Express + TypeScript backend
│   └── web/          # Vue 3 + Vite frontend
├── packages/
│   └── shared/       # Shared types between frontend/backend
├── docker-compose.yml
├── package.json
└── pnpm-workspace.yaml
```

**Key files:**
- `pnpm-workspace.yaml` - Define workspace packages
- `docker-compose.yml` - Redis only
- `package.json` - Root dependencies and scripts

### Step 2: Firebase & Infrastructure Setup (30-45 minutes)

**1. Create Firebase Project:**
1. Go to https://console.firebase.google.com/
2. Click "Add project"
3. Name it "multi-agent-saas" (or your choice)
4. Disable Google Analytics (not needed for MVP)
5. Create project

**2. Enable Firestore:**
1. In Firebase Console, go to "Firestore Database"
2. Click "Create database"
3. Start in **test mode** (open for development)
4. Choose your region (us-central1 recommended)

**3. Enable Firebase Auth:**
1. In Firebase Console, go to "Authentication"
2. Click "Get started"
3. Enable "Google" sign-in provider
4. Add your email as a test user

**4. Get Firebase Config:**
1. Go to Project Settings (gear icon)
2. Under "Your apps", click "</> Web"
3. Register app (name it "web-app")
4. Copy the `firebaseConfig` object

**5. Set up Docker Compose (Redis only):**
```yaml
# docker-compose.yml
services:
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```

**6. Install Firebase SDK:**
```bash
cd apps/api
pnpm add firebase-admin
pnpm add -D @types/node
```

**Firestore Collections Structure:**

Firestore is schema-less, but here's the document structure we'll use:

```typescript
// Collection: users
{
  userId: string; // Auto-generated or from Firebase Auth
  email: string;
  name: string;
  createdAt: Timestamp;
}

// Collection: companies
{
  id: string; // Auto-generated
  userId: string; // Owner
  name: string;
  website?: string;
  description?: string;

  // Embedded research data (sub-document)
  research?: {
    industry?: string;
    targetMarket?: string;
    products?: string[];
    competitors?: string[];
    keyInsights?: string;
    websiteContent?: string;
    createdAt: Timestamp;
  };

  // Embedded sales config (sub-document)
  salesConfig?: {
    productName: string;
    productDesc: string;
    price?: number;
    targetCustomers?: string;
    salesStrategy?: string;
    agentSettings?: any;
    createdAt: Timestamp;
  };

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Collection: tasks
{
  id: string; // Auto-generated
  companyId: string;

  // Agent routing
  sourceDepartment: string; // "SALES", "ACCOUNTING", etc.
  targetDepartment: string;
  createdBy: string; // Which agent created this
  taskType: string; // "GENERATE_INVOICE", etc.

  // Status
  status: string; // "PENDING", "PROCESSING", "COMPLETED", "FAILED"

  // Data
  inputData: any;
  outputData?: any;
  error?: string;

  // Display metadata
  title: string;
  description?: string;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt?: Timestamp;
}
```

**Set up Firestore indexes (optional for MVP, but recommended):**

In Firebase Console > Firestore > Indexes, create:
- Composite index on `tasks`: `companyId` (ASC) + `status` (ASC)
- Composite index on `tasks`: `targetDepartment` (ASC) + `status` (ASC)

Or Firestore will automatically suggest these when you run queries.

### Step 3: Backend API Setup (2-3 hours)

**Initialize Express app:**
```bash
cd apps/api
pnpm add express cors dotenv cheerio axios firebase-admin bullmq ioredis
pnpm add @anthropic-ai/sdk
pnpm add -D @types/express @types/cors tsx
```

**Project structure:**
```
apps/api/
├── src/
│   ├── index.ts              # Entry point
│   ├── config/
│   │   └── firebase.ts       # Firebase Admin initialization
│   ├── agents/
│   │   ├── base-agent.ts     # Abstract base class
│   │   ├── research-agent.ts # Company research agent
│   │   ├── sales-agent.ts    # Sales agent implementation
│   │   └── accounting-agent.ts # Accounting agent
│   ├── services/
│   │   ├── firestore.service.ts # Firestore wrapper/helpers
│   │   ├── company.service.ts # Company CRUD (uses Firestore)
│   │   ├── task.service.ts   # Task CRUD operations (uses Firestore)
│   │   ├── queue.service.ts  # BullMQ wrapper
│   │   ├── scraper.service.ts # Website scraping
│   │   └── ai.service.ts     # Anthropic API wrapper
│   ├── workers/
│   │   └── accounting.worker.ts # Task processor
│   ├── routes/
│   │   ├── companies.routes.ts # Company endpoints
│   │   ├── tasks.routes.ts   # Task API endpoints
│   │   └── agents.routes.ts  # Agent trigger endpoints
│   └── types/
│       └── index.ts          # Shared types
├── serviceAccountKey.json    # Firebase Admin SDK key (gitignored!)
└── package.json
```

**Critical Files:**

**File: `apps/api/src/config/firebase.ts`**
```typescript
import admin from 'firebase-admin';
import serviceAccount from '../../serviceAccountKey.json';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});

export const db = admin.firestore();
export const auth = admin.auth();
```

**File: `apps/api/src/services/firestore.service.ts`**
```typescript
import { db } from '../config/firebase';
import { FieldValue } from 'firebase-admin/firestore';

export class FirestoreService {
  protected collection: FirebaseFirestore.CollectionReference;

  constructor(collectionName: string) {
    this.collection = db.collection(collectionName);
  }

  async create(data: any) {
    const docRef = await this.collection.add({
      ...data,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const doc = await docRef.get();
    return { id: docRef.id, ...doc.data() };
  }

  async getById(id: string) {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  }

  async update(id: string, data: any) {
    await this.collection.doc(id).update({
      ...data,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return this.getById(id);
  }

  async query(field: string, operator: FirebaseFirestore.WhereFilterOp, value: any) {
    const snapshot = await this.collection.where(field, operator, value).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
}
```

**File: `apps/api/src/services/company.service.ts`**
```typescript
import { FirestoreService } from './firestore.service';
import { FieldValue } from 'firebase-admin/firestore';

export class CompanyService extends FirestoreService {
  constructor() {
    super('companies');
  }

  async createCompany(data: {
    userId: string;
    name: string;
    website?: string;
    description?: string;
  }) {
    return this.create(data);
  }

  async getCompany(companyId: string) {
    return this.getById(companyId);
  }

  async saveResearch(companyId: string, researchData: any) {
    return this.update(companyId, {
      research: {
        ...researchData,
        createdAt: FieldValue.serverTimestamp(),
      },
    });
  }

  async saveSalesConfig(companyId: string, salesConfig: any) {
    return this.update(companyId, {
      salesConfig: {
        ...salesConfig,
        createdAt: FieldValue.serverTimestamp(),
      },
    });
  }
}
```

**File: `apps/api/src/services/scraper.service.ts`**
```typescript
import axios from 'axios';
import * as cheerio from 'cheerio';

export class ScraperService {
  async scrapeWebsite(url: string): Promise<string> {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AgentBot/1.0)',
        },
        timeout: 10000,
      });

      const $ = cheerio.load(response.data);

      // Remove script and style elements
      $('script, style, nav, footer, header').remove();

      // Extract main content
      const title = $('title').text();
      const h1s = $('h1').map((_, el) => $(el).text()).get().join('\n');
      const paragraphs = $('p').map((_, el) => $(el).text()).get().join('\n');
      const lists = $('li').map((_, el) => $(el).text()).get().join('\n');

      const content = `
Title: ${title}

Headers: ${h1s}

Content: ${paragraphs}

${lists}
      `.trim();

      // Limit content length
      return content.slice(0, 10000);
    } catch (error) {
      console.error('Scraping error:', error);
      return '';
    }
  }
}
```

**File: `apps/api/src/agents/research-agent.ts`**
```typescript
import { BaseAgent } from './base-agent';
import { ScraperService } from '../services/scraper.service';
import { CompanyService } from '../services/company.service';

export class ResearchAgent extends BaseAgent {
  private scraper: ScraperService;
  private companyService: CompanyService;

  constructor() {
    super('RESEARCH');
    this.scraper = new ScraperService();
    this.companyService = new CompanyService();
  }

  getSystemPrompt(): string {
    return `You are a business research AI agent. Analyze company information and extract key details.

Your job is to:
1. Analyze the provided company information (website content or description)
2. Identify the industry, target market, products/services, and competitors
3. Generate insights about the company's business model

Output your analysis as JSON:
{
  "industry": "e.g., SaaS, E-commerce, Consulting",
  "targetMarket": "who are their customers",
  "products": ["product 1", "product 2"],
  "competitors": ["competitor 1", "competitor 2"],
  "keyInsights": "2-3 sentences about the business"
}`;
  }

  async researchCompany(companyId: string, name: string, website?: string, description?: string) {
    let content = '';

    if (website) {
      // Scrape website
      content = await this.scraper.scrapeWebsite(website);
    } else {
      // Use description
      content = description || '';
    }

    // Let AI analyze
    const prompt = `Analyze this company:
Name: ${name}
${website ? `Website: ${website}` : ''}

Content:
${content}
`;

    const result = await this.execute({ type: 'research', data: { prompt } });

    // Save research to database
    await this.companyService.saveResearch(companyId, {
      industry: result.industry,
      targetMarket: result.targetMarket,
      products: result.products,
      competitors: result.competitors,
      keyInsights: result.keyInsights,
      websiteContent: content.slice(0, 2000), // Store preview
    });

    return result;
  }

  protected buildPrompt(task: any): string {
    return task.data.prompt;
  }

  protected parseResponse(response: string): any {
    return JSON.parse(response);
  }
}
```

**File: `apps/api/src/services/ai.service.ts`**
```typescript
import Anthropic from '@anthropic-ai/sdk';

export class AIService {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });
  }

  async generateCompletion(prompt: string, systemPrompt: string) {
    const response = await this.client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });

    return response.content[0].text;
  }

  async generateWithTools(prompt: string, tools: any[]) {
    const response = await this.client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2048,
      tools,
      messages: [{ role: 'user', content: prompt }],
    });

    return response;
  }
}
```

**File: `apps/api/src/services/task.service.ts`**
```typescript
import { FirestoreService } from './firestore.service';
import { FieldValue } from 'firebase-admin/firestore';

export class TaskService extends FirestoreService {
  constructor() {
    super('tasks');
  }

  async createTask(data: {
    companyId: string;
    sourceDepartment: string;
    targetDepartment: string;
    createdBy: string;
    taskType: string;
    title: string;
    description?: string;
    inputData: any;
  }) {
    return this.create({
      ...data,
      status: 'PENDING',
    });
  }

  async updateStatus(
    taskId: string,
    status: string,
    updates?: { outputData?: any; error?: string }
  ) {
    const updateData: any = {
      status,
      ...updates,
    };

    if (status === 'COMPLETED') {
      updateData.completedAt = FieldValue.serverTimestamp();
    }

    return this.update(taskId, updateData);
  }

  async getTasksByDepartment(targetDepartment: string, status: string) {
    const snapshot = await this.collection
      .where('targetDepartment', '==', targetDepartment)
      .where('status', '==', status)
      .orderBy('createdAt', 'asc')
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async getTasksByCompany(companyId: string) {
    const snapshot = await this.collection
      .where('companyId', '==', companyId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async getTaskById(taskId: string) {
    return this.getById(taskId);
  }
}
```

**File: `apps/api/src/services/queue.service.ts`**
```typescript
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';

const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: 6379,
  maxRetriesPerRequest: null,
});

export class QueueService {
  private queue: Queue;

  constructor(queueName: string) {
    this.queue = new Queue(queueName, { connection });
  }

  async addTask(taskId: string, data: any) {
    return this.queue.add('process-task', {
      taskId,
      ...data,
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });
  }

  createWorker(processor: (job: any) => Promise<any>) {
    return new Worker(this.queue.name, processor, { connection });
  }
}
```

**File: `apps/api/src/agents/base-agent.ts`**
```typescript
import { AIService } from '../services/ai.service';

export abstract class BaseAgent {
  protected ai: AIService;
  protected agentType: string;

  constructor(agentType: string) {
    this.agentType = agentType;
    this.ai = new AIService();
  }

  abstract getSystemPrompt(): string;

  async execute(task: any): Promise<any> {
    const systemPrompt = this.getSystemPrompt();
    const userPrompt = this.buildPrompt(task);

    const response = await this.ai.generateCompletion(userPrompt, systemPrompt);
    return this.parseResponse(response);
  }

  protected abstract buildPrompt(task: any): string;
  protected abstract parseResponse(response: string): any;
}
```

**File: `apps/api/src/agents/sales-agent.ts`**
```typescript
import { BaseAgent } from './base-agent';
import { TaskService } from '../services/task.service';
import { CompanyService } from '../services/company.service';

export class SalesAgent extends BaseAgent {
  private taskService: TaskService;
  private companyService: CompanyService;

  constructor() {
    super('SALES');
    this.taskService = new TaskService();
    this.companyService = new CompanyService();
  }

  getSystemPrompt(): string {
    return `You are a sales agent AI. Your job is to:
1. Qualify leads based on company's sales configuration
2. Generate proposals
3. Close deals
4. When a deal is closed, create an invoice task for the accounting department

Output your response as JSON:
{
  "action": "close_deal" | "qualify_lead" | "generate_proposal",
  "dealDetails": {
    "customerId": "...",
    "customerName": "...",
    "amount": 0,
    "lineItems": [...]
  },
  "needsInvoice": boolean
}`;
  }

  async closeDeal(companyId: string, dealData: {
    customerId: string;
    customerName: string;
    amount: number;
    lineItems: any[];
  }) {
    // Get company context
    const company = await this.companyService.getCompany(companyId);

    // Let AI process the deal
    const prompt = `
Company: ${company.name}
Product: ${company.salesConfig?.productName}
Sales Strategy: ${company.salesConfig?.salesStrategy}

Close this deal: ${JSON.stringify(dealData)}
`;

    const result = await this.execute({ type: 'close_deal', data: { prompt } });

    // Create accounting task
    if (result.needsInvoice) {
      await this.taskService.createTask({
        companyId,
        sourceDepartment: 'SALES',
        targetDepartment: 'ACCOUNTING',
        createdBy: 'sales-agent',
        taskType: 'GENERATE_INVOICE',
        title: `Generate invoice for ${result.dealDetails.customerName}`,
        description: `Deal closed for ${company.salesConfig?.productName} - $${result.dealDetails.amount}`,
        inputData: result.dealDetails,
      });
    }

    return result;
  }

  protected buildPrompt(task: any): string {
    return task.data.prompt;
  }

  protected parseResponse(response: string): any {
    return JSON.parse(response);
  }
}
```

**File: `apps/api/src/agents/accounting-agent.ts`**
```typescript
import { BaseAgent } from './base-agent';

export class AccountingAgent extends BaseAgent {
  constructor() {
    super('ACCOUNTING');
  }

  getSystemPrompt(): string {
    return `You are an accounting agent AI. Your job is to:
1. Generate invoices
2. Track payments
3. Record transactions

For invoice generation, output JSON:
{
  "invoiceId": "INV-XXXX",
  "customerId": "...",
  "amount": 0,
  "lineItems": [...],
  "dueDate": "ISO date",
  "status": "generated"
}`;
  }

  async generateInvoice(taskData: any) {
    return this.execute({
      type: 'generate_invoice',
      data: taskData,
    });
  }

  protected buildPrompt(task: any): string {
    return `Generate invoice for: ${JSON.stringify(task.data, null, 2)}`;
  }

  protected parseResponse(response: string): any {
    return JSON.parse(response);
  }
}
```

**File: `apps/api/src/workers/accounting.worker.ts`**
```typescript
import { QueueService } from '../services/queue.service';
import { TaskService } from '../services/task.service';
import { AccountingAgent } from '../agents/accounting-agent';

const queueService = new QueueService('accounting-tasks');
const taskService = new TaskService();
const accountingAgent = new AccountingAgent();

// Start worker
queueService.createWorker(async (job) => {
  const { taskId } = job.data;

  try {
    // Get task from database
    const task = await taskService.getTaskById(taskId);

    // Update status to processing
    await taskService.updateStatus(taskId, 'PROCESSING');

    // Execute agent
    const result = await accountingAgent.generateInvoice(task.inputData);

    // Update task with result
    await taskService.updateStatus(taskId, 'COMPLETED', {
      outputData: result,
    });

    console.log(`Task ${taskId} completed successfully`);
  } catch (error) {
    console.error(`Task ${taskId} failed:`, error);
    await taskService.updateStatus(taskId, 'FAILED', {
      error: error.message,
    });
    throw error; // Re-throw for BullMQ retry logic
  }
});

console.log('Accounting worker started');
```

**File: `apps/api/src/routes/companies.routes.ts`**
```typescript
import express from 'express';
import { CompanyService } from '../services/company.service';
import { ResearchAgent } from '../agents/research-agent';

const router = express.Router();
const companyService = new CompanyService();
const researchAgent = new ResearchAgent();

// Create new company
router.post('/', async (req, res) => {
  try {
    const { userId, name, website, description } = req.body;
    const company = await companyService.createCompany({
      userId,
      name,
      website,
      description,
    });
    res.json(company);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Trigger AI research for company
router.post('/:companyId/research', async (req, res) => {
  try {
    const { companyId } = req.params;
    const company = await companyService.getCompany(companyId);

    const research = await researchAgent.researchCompany(
      companyId,
      company.name,
      company.website,
      company.description
    );

    res.json(research);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save sales configuration
router.post('/:companyId/sales-config', async (req, res) => {
  try {
    const { companyId } = req.params;
    const salesConfig = await companyService.saveSalesConfig(companyId, req.body);
    res.json(salesConfig);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get company with all data
router.get('/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    const company = await companyService.getCompany(companyId);
    res.json(company);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

**File: `apps/api/src/routes/agents.routes.ts`**
```typescript
import express from 'express';
import { SalesAgent } from '../agents/sales-agent';

const router = express.Router();
const salesAgent = new SalesAgent();

// Trigger sales agent to close a deal
router.post('/sales/close-deal', async (req, res) => {
  try {
    const { companyId, dealData } = req.body;
    const result = await salesAgent.closeDeal(companyId, dealData);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

**File: `apps/api/src/index.ts`**
```typescript
import express from 'express';
import cors from 'cors';
import companyRoutes from './routes/companies.routes';
import agentRoutes from './routes/agents.routes';
import taskRoutes from './routes/tasks.routes';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/companies', companyRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/tasks', taskRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});
```

**File: `apps/api/src/routes/tasks.routes.ts`**
```typescript
import express from 'express';
import { TaskService } from '../services/task.service';

const router = express.Router();
const taskService = new TaskService();

// Get all tasks for a company
router.get('/company/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    const tasks = await taskService.getTasksByCompany(companyId);
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get task by ID
router.get('/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = await taskService.getTaskById(taskId);
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

### Step 4: Frontend Setup (Vue 3) (2-3 hours)

**Initialize Vue 3 app:**
```bash
cd apps/web
pnpm create vite@latest . --template vue-ts
pnpm add vue-router pinia axios
pnpm add -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

**Project structure:**
```
apps/web/
├── src/
│   ├── main.ts
│   ├── App.vue
│   ├── router/
│   │   └── index.ts
│   ├── stores/
│   │   └── company.ts
│   ├── views/
│   │   ├── OnboardingView.vue    # Company creation
│   │   ├── DashboardView.vue     # Main dashboard
│   │   └── TaskListView.vue      # Task list
│   ├── components/
│   │   ├── CompanyForm.vue       # Create company form
│   │   ├── ResearchResults.vue   # Show AI research
│   │   ├── SalesConfigForm.vue   # Configure sales
│   │   └── TaskItem.vue          # Task list item
│   └── api/
│       └── client.ts             # API client
└── package.json
```

**File: `apps/web/src/api/client.ts`**
```typescript
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const companyApi = {
  create: (data: { userId: string; name: string; website?: string; description?: string }) =>
    apiClient.post('/companies', data),

  research: (companyId: string) =>
    apiClient.post(`/companies/${companyId}/research`),

  saveSalesConfig: (companyId: string, config: any) =>
    apiClient.post(`/companies/${companyId}/sales-config`, config),

  get: (companyId: string) =>
    apiClient.get(`/companies/${companyId}`),
};

export const agentApi = {
  closeDeal: (companyId: string, dealData: any) =>
    apiClient.post('/agents/sales/close-deal', { companyId, dealData }),
};

export const taskApi = {
  getByCompany: (companyId: string) =>
    apiClient.get(`/tasks/company/${companyId}`),

  getById: (taskId: string) =>
    apiClient.get(`/tasks/${taskId}`),
};
```

**File: `apps/web/src/stores/company.ts`**
```typescript
import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useCompanyStore = defineStore('company', () => {
  const currentCompany = ref(null);
  const tasks = ref([]);

  function setCompany(company: any) {
    currentCompany.value = company;
  }

  function setTasks(newTasks: any[]) {
    tasks.value = newTasks;
  }

  return {
    currentCompany,
    tasks,
    setCompany,
    setTasks,
  };
});
```

**File: `apps/web/src/views/OnboardingView.vue`**
```vue
<template>
  <div class="max-w-2xl mx-auto p-8">
    <h1 class="text-3xl font-bold mb-8">Create Your Company</h1>

    <!-- Step 1: Company Info -->
    <div v-if="step === 1" class="bg-white p-6 rounded shadow">
      <h2 class="text-xl mb-4">Company Information</h2>

      <div class="space-y-4">
        <div>
          <label class="block mb-2">Company Name</label>
          <input
            v-model="companyData.name"
            type="text"
            class="w-full border p-2 rounded"
            placeholder="Acme Inc."
          />
        </div>

        <div>
          <label class="block mb-2">Website (optional)</label>
          <input
            v-model="companyData.website"
            type="url"
            class="w-full border p-2 rounded"
            placeholder="https://acme.com"
          />
        </div>

        <div>
          <label class="block mb-2">Or provide a detailed description</label>
          <textarea
            v-model="companyData.description"
            class="w-full border p-2 rounded"
            rows="4"
            placeholder="Describe what your company does..."
          ></textarea>
        </div>

        <button
          @click="createCompany"
          :disabled="!companyData.name"
          class="bg-blue-500 text-white px-6 py-2 rounded disabled:opacity-50"
        >
          Continue →
        </button>
      </div>
    </div>

    <!-- Step 2: AI Research -->
    <div v-if="step === 2" class="bg-white p-6 rounded shadow">
      <h2 class="text-xl mb-4">AI is researching your company...</h2>

      <div v-if="loading" class="text-center py-8">
        <div class="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent mx-auto"></div>
        <p class="mt-4">Analyzing {{ companyData.website || 'company info' }}...</p>
      </div>

      <div v-if="research" class="space-y-4">
        <div>
          <strong>Industry:</strong> {{ research.industry }}
        </div>
        <div>
          <strong>Target Market:</strong> {{ research.targetMarket }}
        </div>
        <div>
          <strong>Products:</strong>
          <ul class="list-disc ml-5">
            <li v-for="product in research.products" :key="product">{{ product }}</li>
          </ul>
        </div>
        <div>
          <strong>Key Insights:</strong>
          <p>{{ research.keyInsights }}</p>
        </div>

        <button
          @click="step = 3"
          class="bg-blue-500 text-white px-6 py-2 rounded"
        >
          Continue to Sales Setup →
        </button>
      </div>
    </div>

    <!-- Step 3: Sales Configuration -->
    <div v-if="step === 3" class="bg-white p-6 rounded shadow">
      <h2 class="text-xl mb-4">Configure Sales Agent</h2>

      <div class="space-y-4">
        <div>
          <label class="block mb-2">Product/Service to Sell</label>
          <input
            v-model="salesConfig.productName"
            type="text"
            class="w-full border p-2 rounded"
            placeholder="Premium Plan"
          />
        </div>

        <div>
          <label class="block mb-2">Product Description</label>
          <textarea
            v-model="salesConfig.productDesc"
            class="w-full border p-2 rounded"
            rows="3"
          ></textarea>
        </div>

        <div>
          <label class="block mb-2">Price</label>
          <input
            v-model.number="salesConfig.price"
            type="number"
            class="w-full border p-2 rounded"
            placeholder="9.99"
          />
        </div>

        <div>
          <label class="block mb-2">Target Customers</label>
          <input
            v-model="salesConfig.targetCustomers"
            type="text"
            class="w-full border p-2 rounded"
            placeholder="Small businesses"
          />
        </div>

        <button
          @click="saveSalesConfig"
          class="bg-green-500 text-white px-6 py-2 rounded"
        >
          Complete Setup →
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { companyApi } from '../api/client';
import { useCompanyStore } from '../stores/company';

const router = useRouter();
const companyStore = useCompanyStore();

const step = ref(1);
const loading = ref(false);
const companyId = ref('');

const companyData = ref({
  name: '',
  website: '',
  description: '',
});

const research = ref(null);

const salesConfig = ref({
  productName: '',
  productDesc: '',
  price: 0,
  targetCustomers: '',
});

async function createCompany() {
  loading.value = true;
  try {
    const response = await companyApi.create({
      userId: 'user-123', // TODO: Get from auth
      ...companyData.value,
    });

    companyId.value = response.data.id;
    step.value = 2;

    // Trigger AI research
    const researchResponse = await companyApi.research(companyId.value);
    research.value = researchResponse.data;
  } catch (error) {
    console.error('Error:', error);
    alert('Error creating company');
  } finally {
    loading.value = false;
  }
}

async function saveSalesConfig() {
  try {
    await companyApi.saveSalesConfig(companyId.value, salesConfig.value);

    // Load full company data
    const company = await companyApi.get(companyId.value);
    companyStore.setCompany(company.data);

    // Redirect to dashboard
    router.push('/dashboard');
  } catch (error) {
    console.error('Error:', error);
    alert('Error saving sales config');
  }
}
</script>
```

**File: `apps/web/src/views/DashboardView.vue`**
```vue
<template>
  <div class="p-8">
    <div class="mb-8">
      <h1 class="text-3xl font-bold">{{ company?.name }}</h1>
      <p class="text-gray-600">{{ company?.research?.industry }}</p>
    </div>

    <!-- Quick Actions -->
    <div class="grid grid-cols-2 gap-4 mb-8">
      <div class="bg-white p-6 rounded shadow">
        <h2 class="text-xl mb-4">Close a Deal</h2>

        <button
          @click="closeDeal"
          class="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Close Deal & Create Invoice
        </button>
      </div>

      <div class="bg-white p-6 rounded shadow">
        <h2 class="text-xl mb-4">Task Statistics</h2>
        <p>Pending: {{ pendingTasks.length }}</p>
        <p>Completed: {{ completedTasks.length }}</p>
      </div>
    </div>

    <!-- Task List -->
    <div class="bg-white p-6 rounded shadow">
      <h2 class="text-2xl font-bold mb-4">Task List</h2>

      <div class="space-y-2">
        <div
          v-for="task in tasks"
          :key="task.id"
          class="border p-4 rounded hover:bg-gray-50"
        >
          <div class="flex justify-between items-start">
            <div>
              <h3 class="font-bold">{{ task.title }}</h3>
              <p class="text-sm text-gray-600">{{ task.description }}</p>
              <div class="text-xs text-gray-500 mt-2">
                <span class="bg-blue-100 px-2 py-1 rounded">{{ task.sourceDepartment }}</span>
                →
                <span class="bg-green-100 px-2 py-1 rounded">{{ task.targetDepartment }}</span>
              </div>
            </div>
            <div>
              <span
                :class="{
                  'bg-yellow-100 text-yellow-800': task.status === 'PENDING',
                  'bg-blue-100 text-blue-800': task.status === 'PROCESSING',
                  'bg-green-100 text-green-800': task.status === 'COMPLETED',
                  'bg-red-100 text-red-800': task.status === 'FAILED',
                }"
                class="px-3 py-1 rounded text-sm"
              >
                {{ task.status }}
              </span>
            </div>
          </div>
        </div>

        <div v-if="tasks.length === 0" class="text-center py-8 text-gray-500">
          No tasks yet
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useCompanyStore } from '../stores/company';
import { agentApi, taskApi } from '../api/client';

const companyStore = useCompanyStore();
const company = computed(() => companyStore.currentCompany);
const tasks = computed(() => companyStore.tasks);

const pendingTasks = computed(() =>
  tasks.value.filter((t: any) => t.status === 'PENDING')
);

const completedTasks = computed(() =>
  tasks.value.filter((t: any) => t.status === 'COMPLETED')
);

async function closeDeal() {
  const dealData = {
    customerId: 'CUST-' + Date.now(),
    customerName: 'Test Customer',
    amount: company.value.salesConfig.price,
    lineItems: [
      {
        name: company.value.salesConfig.productName,
        price: company.value.salesConfig.price,
      },
    ],
  };

  await agentApi.closeDeal(company.value.id, dealData);
  alert('Deal closed! Task created for accounting.');

  // Refresh tasks
  loadTasks();
}

async function loadTasks() {
  const response = await taskApi.getByCompany(company.value.id);
  companyStore.setTasks(response.data);
}

onMounted(() => {
  loadTasks();
  // Poll for task updates every 5 seconds
  setInterval(loadTasks, 5000);
});
</script>
```

### Step 5: Testing & Verification (1-2 hours)

**Start all services:**
```bash
# Terminal 1: Start Docker
docker-compose up

# Terminal 2: Start API
cd apps/api
pnpm dev

# Terminal 3: Start accounting worker
cd apps/api
pnpm worker

# Terminal 4: Start frontend
cd apps/web
pnpm dev
```

**Manual Test Flow:**
1. Open browser to `http://localhost:5173` (Vite default)
2. Fill in company name and website/description
3. Click "Continue" - AI should research the company
4. Review research results
5. Configure sales (product, price, etc.)
6. Click "Complete Setup" - redirects to dashboard
7. Click "Close Deal & Create Invoice" on dashboard
8. Check task list - new task should appear as PENDING
9. Check worker logs - task should be picked up
10. Refresh task list - task status should update to COMPLETED

**Verification (Firebase Console or code):**

**Option 1: Firebase Console**
1. Go to Firebase Console > Firestore Database
2. Check `companies` collection - should see your company
3. Expand company document - see `research` and `salesConfig` sub-objects
4. Check `tasks` collection - should see tasks with status updates

**Option 2: Add test endpoint in API**
```typescript
// apps/api/src/routes/debug.routes.ts (dev only)
router.get('/debug/companies', async (req, res) => {
  const snapshot = await db.collection('companies').get();
  const companies = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  res.json(companies);
});

router.get('/debug/tasks', async (req, res) => {
  const snapshot = await db.collection('tasks').orderBy('createdAt', 'desc').get();
  const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  res.json(tasks);
});
```

Then visit:
- `http://localhost:3001/api/debug/companies`
- `http://localhost:3001/api/debug/tasks`

**Success Criteria:**
✅ Company created in database
✅ AI researches company (scrapes website or analyzes description)
✅ Research saved to database
✅ Sales configuration saved
✅ Sales agent creates task with proper metadata (title, description, departments)
✅ Task is queued in Redis
✅ Accounting worker picks up task
✅ Accounting agent processes task with Claude
✅ Task status updates to COMPLETED
✅ Task list UI shows department flow (SALES → ACCOUNTING)

## Project Timeline

**Day 1: Foundation**
- Monorepo setup (PNPM workspace)
- Firebase project setup (Firestore + Auth)
- Docker Compose (Redis only)
- Firestore collections structure (Company, Tasks)
- Basic Express API structure with Firebase Admin SDK

**Day 2: Company & Research**
- Company CRUD service and routes
- Web scraper service
- Research agent with Claude integration
- Test company creation and AI research flow

**Day 3: Sales & Accounting Agents**
- Sales agent implementation
- Accounting agent implementation
- Task service with department tracking
- BullMQ queue and worker setup

**Day 4: Vue 3 Frontend**
- Vue 3 + Vite setup with Tailwind
- Onboarding flow (3-step wizard)
- Dashboard with task list
- API client integration

**Day 5: Integration & Testing**
- End-to-end testing
- Bug fixes and polish
- Documentation

**Total: ~5 days for minimal MVP**

## Future Enhancements (Post-MVP)

Once the core works, consider:
1. **Real-time updates** - Replace polling with Firestore real-time listeners in Vue (onSnapshot). Firestore natively supports real-time updates, no WebSocket needed!
2. **Proper authentication** - Implement Firebase Auth in Vue, verify ID tokens in API middleware
3. **Task history UI** - View all tasks and their status with filtering/search
4. **More agent types** - Customer support, marketing, operations
5. **Agent memory** - Store context between tasks (use Firestore + vector DB for RAG)
6. **Workflow builder** - Visual editor for multi-step workflows
7. **Production deployment** - Deploy API to Cloud Run/Railway, Vue to Vercel/Netlify

## Environment Variables Needed

**apps/api/.env:**
```
REDIS_HOST="localhost"
REDIS_PORT=6379
ANTHROPIC_API_KEY="your-anthropic-api-key"
PORT=3001
```

**apps/api/serviceAccountKey.json:**

Download this from Firebase Console:
1. Go to Project Settings > Service Accounts
2. Click "Generate new private key"
3. Save as `serviceAccountKey.json` in `apps/api/` directory
4. **IMPORTANT:** Add to `.gitignore` - never commit this file!

**apps/web/.env:**
```
VITE_API_URL="http://localhost:3001/api"

# Firebase Web SDK config (from Firebase Console > Project Settings > Web App)
VITE_FIREBASE_API_KEY="your-web-api-key"
VITE_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="your-project-id"
VITE_FIREBASE_STORAGE_BUCKET="your-project.appspot.com"
VITE_FIREBASE_MESSAGING_SENDER_ID="123456789"
VITE_FIREBASE_APP_ID="your-app-id"
```

**Note on Authentication:**
For the MVP, we're using hardcoded `userId: 'user-123'` in the API. Firebase Auth is set up but not enforced yet. In production:
1. Add Firebase Auth to Vue frontend
2. Send ID tokens with API requests
3. Verify tokens in Express middleware
4. Use authenticated user's ID from token

## Critical Success Factors

1. **Keep it simple** - No over-engineering, prove the concept first
2. **Focus on agent communication** - The task queue pattern is the key innovation
3. **Make it observable** - Lots of console.log statements to see what's happening
4. **Test manually first** - Get the happy path working before writing tests
5. **Document as you go** - README with setup instructions

---

This plan prioritizes **speed to working prototype** over production-readiness. The goal is to prove that agents can coordinate via tasks within 1 week, then iterate from there.
