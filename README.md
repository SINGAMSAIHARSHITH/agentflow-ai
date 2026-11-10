# H1-multilevel (AgentFlow AI)

**One conversation. Multiple intelligent agents.**

Live GitHub Pages URL: [https://singamsaiharshith.github.io/agentflow-ai/](https://singamsaiharshith.github.io/agentflow-ai/)

H1-multilevel is an Autonomous Multi-Agent AI System for Smart Task Coordination and Decision Support, featuring a minimal, light, conversational interface with warm off-white, soft peach, and white glass surfaces.

## Key Capabilities

1. **Chat-First Multi-Agent Interface**
   - Describe any project, research topic, decision, or task list in natural language.
   - Starter suggestion cards (`Plan a project.`, `Research a topic.`, `Analyse a decision.`, `Organise my tasks.`) populate the rounded white glass message composer.
   - Manage multiple conversations in the collapsible left sidebar with search, inline rename, and delete confirmation.

2. **7 Coordinated AI Agents (Agents A–G)**
   - **Agent A — Manager / Orchestrator**: Interprets goals, asks clarifying questions when critical constraints are missing, builds workflow plans, and coordinates specialists.
   - **Agent B — Research Agent**: Gathers structured context, benchmarks, and risks.
   - **Agent C — Strategy & Planning Agent**: Decomposes goals into dependency-aware tasks with critical-path effort estimates.
   - **Agent D — Execution Agent**: Produces Markdown deliverables, checklists, and implementation artifacts.
   - **Agent E — Decision Intelligence Agent**: Evaluates alternatives with interactive weighted criteria sliders, pros/cons/risks, and reversal conditions.
   - **Agent F — Verification Agent**: Audits task outputs against acceptance criteria.
   - **Agent G — Monitoring Agent**: Detects overdue tasks, failed steps, and approval bottlenecks.

3. **Inline Interactive Workflow, Decision & Deliverable Cards**
   - Review, edit, approve, or reject multi-agent workflow plans directly inside the conversation.
   - Adjust decision criteria weights in real time and save updated recommendations.
   - Preview, copy, revise, or download deliverables as `.MD` or `.TXT`.

## GitHub Pages Deployment

The project is pre-configured to deploy to `https://singamsaiharshith.github.io/agentflow-ai/` via `.github/workflows/deploy.yml`:
- Vite `base` is configured as `/agentflow-ai/` in `vite.config.ts`.
- `public/404.html` and `index.html` handle SPA nested route refreshes on GitHub Pages (`/agentflow-ai/chat/...`).
- `src/core/clientApi.ts` provides a complete client-side multi-agent orchestration and `localStorage` persistence engine when hosted on static GitHub Pages.

## Running Locally

```bash
npm install
npm run dev
```

Build for production:
```bash
npm run build
```

Run unit tests:
```bash
./node_modules/.bin/tsx --test src/core/orchestrator.test.ts
```
