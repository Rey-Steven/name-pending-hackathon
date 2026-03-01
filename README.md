# Greek Business Multi-Agent Automation Platform

A 24-hour hackathon project that automates Greek B2B business workflows using AI agents.

## 🎯 Live Demo

Check it out: https://agentive.onrender.com/

## 🎯 Goal

Help traditional Greek businesses automate manual workflows with coordinating AI agents that handle lead qualification, sales, legal compliance, invoicing, and customer communication.

## 🤖 Agents

- **Marketing Agent** (Cyan): Lead enrichment and scoring
- **Sales Agent** (Blue): Deal qualification and closure
- **Legal Agent** (Purple): Contract review and compliance
- **Accounting Agent** (Red): Invoice generation with Greek FPA
- **Email Agent** (Orange): Customer communication

## 🏗️ Architecture

- **Backend**: Node.js + TypeScript + Express + Firebase Firestore
- **Frontend**: Vue 3 + Pinia + Tailwind CSS
- **AI**: Anthropic Claude (Opus + Sonnet + Haiku)
- **Queue**: Firestore-backed task queue

## 🚀 Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   cd backend && npm install
   cd ../frontend && npm install
   cd ..
   ```

2. **Set up environment:**
   ```bash
   cp .env.example .env
   # Edit .env and add your ANTHROPIC_API_KEY
   ```

3. **Run development servers:**
   ```bash
   npm run dev
   ```

4. **Access the application:**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001

## 📝 Implementation Plan

See [ultimate-plan.md](ultimate-plan.md) for the complete 24-hour implementation roadmap.

## 🎬 Demo

The demo showcases a complete lead-to-invoice workflow:
1. Marketing Agent qualifies a new Greek business lead
2. Sales Agent closes the deal and creates tasks
3. Legal Agent validates AFM and compliance (parallel)
4. Accounting Agent generates Greek invoice with 24% FPA (parallel)
5. Email Service sends customer notification

All completed in ~10 seconds with zero human intervention.

## 📊 Evaluation Criteria

- ✅ **Depth of Reasoning**: Each agent demonstrates complex decision-making
- ✅ **Real World Applicable**: Solves actual Greek B2B pain points
- ✅ **Demo Quality**: Polished UI with real-time agent pipeline visualization

## 🇬🇷 Greek Business Features

- AFM (tax ID) validation
- FPA (24% VAT) calculation
- myDATA compliant invoices
- Greek language communication
- GDPR compliance checking

## 🏗️ Project Structure

```
├── backend/          # Node.js + Express API
│   └── src/
│       ├── agents/   # 5 AI agents
│       ├── services/ # AI, Queue, Workflow
│       ├── routes/   # REST API
│       ├── database/ # Firebase Firestore
│       └── types/    # TypeScript type definitions
│
├── frontend/         # Vue 3 SPA
│   └── src/
│       ├── views/    # Pages
│       ├── components/  # Reusable components
│       ├── stores/   # Pinia state management
│       ├── api/      # API client
│       └── utils/    # Utility functions
│
└── scripts/          # Data import & utilities
```

## 📄 License

MIT
