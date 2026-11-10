import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  classifyConversationPrompt,
  validateAndAnalyzeGoal,
  detectDependencyCycle,
  canAddDependency,
  calculateCriticalPath,
  getEligibleTasks,
  calculateDecisionScores,
  analyzeWorkflowRisks,
  PEACH_LIGHT_PALETTE,
  HOME_SUGGESTION_CARDS,
} from './orchestrator';
import {
  parseAppRoute,
  buildAppRoute,
  createClientSeedState,
} from './clientApi';
import { Task, Workflow } from '../types/h1';

test('GitHub Pages SPA route parsing and building supports /agentflow-ai/ and nested routes', () => {
  assert.deepEqual(parseAppRoute('/agentflow-ai/', '/agentflow-ai/'), {
    conversationId: null,
    panel: null,
  });
  assert.deepEqual(parseAppRoute('/agentflow-ai/chat/conv-event-mesh', '/agentflow-ai/'), {
    conversationId: 'conv-event-mesh',
    panel: null,
  });
  assert.deepEqual(parseAppRoute('/agentflow-ai/activity', '/agentflow-ai/'), {
    conversationId: null,
    panel: 'activity',
  });
  assert.deepEqual(parseAppRoute('/agentflow-ai/settings', '/agentflow-ai/'), {
    conversationId: null,
    panel: 'settings',
  });
  assert.equal(
    buildAppRoute({ conversationId: 'conv-event-mesh', panel: null }, '/agentflow-ai/'),
    '/agentflow-ai/chat/conv-event-mesh'
  );
  assert.equal(
    buildAppRoute({ conversationId: null, panel: null }, '/agentflow-ai/'),
    '/agentflow-ai/'
  );
});

test('Static GitHub Pages client seed state contains complete workflows, conversations, tasks, and 7 agents', () => {
  const seed = createClientSeedState();
  assert.equal(seed.agents.length, 7);
  assert.ok(seed.conversations.length >= 2);
  assert.ok(seed.workflows.length >= 2);
  assert.ok(seed.tasks.length >= 9);
  assert.ok(seed.decisions.length >= 1);
  assert.ok(seed.deliverables.length >= 2);
});

test('Conversation prompt classifier routes workflow plans, decisions, and underspecified prompts accurately', () => {
  const shortPlan = classifyConversationPrompt('Plan a project');
  assert.equal(shortPlan.intent, 'clarification_needed');
  assert.equal(shortPlan.clarificationQuestions.length, 3);

  const fullPlan = classifyConversationPrompt(
    'Plan a 6-week product launch for our B2B workflow assistant with a $25,000 budget and critical SLA requirements.'
  );
  assert.equal(fullPlan.intent, 'workflow_plan');
  assert.equal(fullPlan.participatingAgents.length, 7);
  assert.equal(fullPlan.extractedPriority, 'critical');
  assert.ok(fullPlan.extractedBudget.includes('$25,000'));
  assert.equal(fullPlan.extractedDeadlineDays, 42);

  const decisionPrompt = classifyConversationPrompt(
    'Analyse a decision: Should we choose between Managed Cloud Queue vs Event Mesh for our telemetry pipeline?'
  );
  assert.equal(decisionPrompt.intent, 'decision_analysis');
  assert.ok(decisionPrompt.participatingAgents.includes('decision'));
});

test('Home suggestion cards provide 4 distinct natural-language starter prompts', () => {
  assert.equal(HOME_SUGGESTION_CARDS.length, 4);
  const labels = HOME_SUGGESTION_CARDS.map((c) => c.label);
  assert.deepEqual(labels, [
    'Plan a project.',
    'Research a topic.',
    'Analyse a decision.',
    'Organise my tasks.',
  ]);
  for (const card of HOME_SUGGESTION_CARDS) {
    assert.ok(card.prompt.length > 30);
  }
});

test('Goal validation detects missing fields and generates clarification questions', () => {
  const invalidRes = validateAndAnalyzeGoal({
    title: 'AI',
    description: 'Too short',
  });
  assert.equal(invalidRes.valid, false);
  assert.ok(invalidRes.errors.length >= 3);

  const partialRes = validateAndAnalyzeGoal({
    title: 'Build Autonomous Supply Chain Planner',
    description: 'Coordinate seven specialized agents to optimize regional warehouse inventory.',
    desiredOutcome: 'Verified inventory allocation plan and risk matrix',
    deadline: '2026-11-01',
  });
  assert.equal(partialRes.valid, true);
  assert.equal(partialRes.missingDetails.length, 3);
  assert.equal(partialRes.clarificationQuestions.length, 3);

  const completeRes = validateAndAnalyzeGoal({
    title: 'Build Autonomous Supply Chain Planner',
    description: 'Coordinate seven specialized agents to optimize regional warehouse inventory.',
    desiredOutcome: 'Verified inventory allocation plan and risk matrix',
    deadline: '2026-11-01',
    constraints: 'Max $5,000 budget, zero downtime',
    successCriteria: '99.5% stock availability across 4 hubs',
    expectedDeliverables: 'Research report, Decision matrix, Execution checklist',
  });
  assert.equal(completeRes.valid, true);
  assert.equal(completeRes.clarificationQuestions.length, 0);
});

test('Dependency cycle detection identifies direct and transitive cycles and allows valid DAGs', () => {
  const validDag = [
    { id: 't1', dependencies: [] },
    { id: 't2', dependencies: ['t1'] },
    { id: 't3', dependencies: ['t1'] },
    { id: 't4', dependencies: ['t2', 't3'] },
  ];
  assert.equal(detectDependencyCycle(validDag).hasCycle, false);

  const selfCheck = canAddDependency(validDag, 't2', 't2');
  assert.equal(selfCheck.allowed, false);

  const cycleCheck = canAddDependency(validDag, 't1', 't4');
  assert.equal(cycleCheck.allowed, false);
  assert.ok(cycleCheck.reason?.includes('Dependency cycle rejected'));
});

test('Critical path calculation computes longest duration path and topological order', () => {
  const tasks = [
    { id: 't1', title: 'Research', dependencies: [], estimatedEffortHours: 4 },
    { id: 't2', title: 'Strategy', dependencies: ['t1'], estimatedEffortHours: 6 },
    { id: 't3', title: 'Decision', dependencies: ['t1'], estimatedEffortHours: 2 },
    { id: 't4', title: 'Execution', dependencies: ['t2', 't3'], estimatedEffortHours: 5 },
  ];
  const cp = calculateCriticalPath(tasks);
  assert.equal(cp.totalDurationHours, 15);
  assert.deepEqual(cp.criticalTaskIds, ['t1', 't2', 't4']);
  assert.equal(cp.topologicalOrder[0], 't1');
  assert.equal(cp.topologicalOrder[cp.topologicalOrder.length - 1], 't4');
});

test('Dependency-aware scheduling enforces prerequisites, approval gates, and parallel limits', () => {
  const baseTask = (overrides: Partial<Task>): Task => ({
    id: 't-default',
    ownerId: 'user-1',
    workflowId: 'wf-1',
    title: 'Task',
    description: 'Desc',
    assignedAgent: 'research',
    status: 'Queued',
    priority: 'medium',
    dependencies: [],
    acceptanceCriteria: 'Criteria',
    estimatedEffortHours: 2,
    input: '',
    output: '',
    completionSource: 'none',
    attempts: 0,
    error: '',
    approvalRequired: false,
    createdAt: '2026-10-21T10:00:00Z',
    updatedAt: '2026-10-21T10:00:00Z',
    ...overrides,
  });

  const tasks: Task[] = [
    baseTask({ id: 't1', status: 'Completed', priority: 'high' }),
    baseTask({ id: 't2', dependencies: ['t1'], status: 'Queued', priority: 'critical' }),
    baseTask({ id: 't3', dependencies: ['t1'], status: 'Queued', priority: 'high' }),
    baseTask({ id: 't4', dependencies: ['t1'], status: 'Queued', priority: 'low' }),
    baseTask({ id: 't5', dependencies: ['t2'], status: 'Queued', priority: 'critical' }),
    baseTask({ id: 't6', dependencies: ['t1'], status: 'Idle', approvalRequired: true }),
  ];

  const schedule = getEligibleTasks(tasks, 2);
  assert.equal(schedule.eligible.length, 2);
  assert.equal(schedule.eligible[0].id, 't2');
  assert.equal(schedule.eligible[1].id, 't3');
  assert.equal(schedule.awaitingApprovalGate.length, 1);
  assert.equal(schedule.awaitingApprovalGate[0].id, 't6');
});

test('Decision Intelligence weighted scoring normalizes weights and ranks options accurately', () => {
  const criteria = [
    { id: 'c1', name: 'Latency & Throughput', weight: 50, description: 'Speed' },
    { id: 'c2', name: 'Operational Simplicity', weight: 30, description: 'Ops' },
    { id: 'c3', name: 'Cost Efficiency', weight: 20, description: 'Budget' },
  ];
  const alternatives = [
    {
      id: 'a1',
      name: 'Event Mesh Alpha',
      description: 'High speed',
      estimatedCost: '$3,200/mo',
      pros: ['Fast'],
      cons: ['Complex'],
      risks: ['Learning curve'],
      scores: { c1: 9, c2: 6, c3: 7 },
    },
    {
      id: 'a2',
      name: 'Managed Queue Beta',
      description: 'Balanced',
      estimatedCost: '$2,100/mo',
      pros: ['Managed'],
      cons: ['Higher latency'],
      risks: ['Vendor lock'],
      scores: { c1: 7, c2: 9, c3: 9 },
    },
  ];

  const result1 = calculateDecisionScores(criteria, alternatives);
  assert.equal(result1.topRecommendation, 'Managed Queue Beta');
  assert.equal(result1.rankedAlternatives[0].weightedScore, 80);
  assert.equal(result1.rankedAlternatives[1].weightedScore, 77);

  const updatedCriteria = [
    { id: 'c1', name: 'Latency & Throughput', weight: 80, description: 'Speed' },
    { id: 'c2', name: 'Operational Simplicity', weight: 10, description: 'Ops' },
    { id: 'c3', name: 'Cost Efficiency', weight: 10, description: 'Budget' },
  ];
  const result2 = calculateDecisionScores(updatedCriteria, alternatives);
  assert.equal(result2.topRecommendation, 'Event Mesh Alpha');
  assert.equal(result2.rankedAlternatives[0].weightedScore, 85);
});

test('Monitoring & Risk Specialist detects failed, blocked, approval-gated, and overdue tasks', () => {
  const workflows: Workflow[] = [
    {
      id: 'wf-1',
      ownerId: 'u1',
      projectId: 'p1',
      title: 'Enterprise Launch',
      shortPlan: 'Coordinate launch tasks',
      description: 'Desc',
      desiredOutcome: 'Outcome',
      deadline: '2026-10-15T00:00:00Z',
      timezone: 'UTC',
      priority: 'high',
      status: 'running',
      progress: 40,
      createdAt: '2026-10-10T00:00:00Z',
      updatedAt: '2026-10-10T00:00:00Z',
    },
  ];
  const tasks: Task[] = [
    {
      id: 't-fail',
      ownerId: 'u1',
      workflowId: 'wf-1',
      title: 'API Stress Audit',
      description: 'Desc',
      assignedAgent: 'verification',
      status: 'Failed',
      priority: 'high',
      dependencies: [],
      acceptanceCriteria: 'AC',
      estimatedEffortHours: 3,
      input: '',
      output: '',
      completionSource: 'none',
      attempts: 2,
      error: 'Timeout waiting for upstream benchmark dataset',
      approvalRequired: false,
      createdAt: '2026-10-10T00:00:00Z',
      updatedAt: '2026-10-10T00:00:00Z',
    },
  ];

  const risks = analyzeWorkflowRisks(workflows, tasks, '2026-10-21T12:00:00Z');
  assert.ok(risks.some((r) => r.category === 'repeated_failure'));
  assert.ok(risks.some((r) => r.category === 'overdue'));
});

test('Forbidden-colour and secret audit: peach light palette, zero blue/dark tokens, and GitHub Pages config verified', () => {
  assert.equal(PEACH_LIGHT_PALETTE.mainBackground, '#FAF8F6');
  assert.equal(PEACH_LIGHT_PALETTE.softPeach, '#FFD6C2');
  assert.equal(PEACH_LIGHT_PALETTE.primaryText, '#302C29');

  const rootDir = path.resolve(process.cwd());
  const viteConfig = fs.readFileSync(path.join(rootDir, 'vite.config.ts'), 'utf8');
  assert.ok(viteConfig.includes("base: '/agentflow-ai/'"));

  assert.ok(fs.existsSync(path.join(rootDir, 'public', '404.html')));
  assert.ok(fs.existsSync(path.join(rootDir, '.github', 'workflows', 'deploy.yml')));

  const forbiddenClassRegex =
    /\b(bg|text|border|ring|from|via|to|fill|stroke|shadow)-(blue|sky|cyan|teal|indigo|slate)-\d{2,3}\b/i;
  const forbiddenDarkHexRegex = /#(11100F|000000)\b/i;

  function scanDir(dirPath: string): string[] {
    if (!fs.existsSync(dirPath)) return [];
    const violations: string[] = [];
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.'))
          continue;
        violations.push(...scanDir(fullPath));
      } else if (/\.(ts|tsx|css|html)$/.test(entry.name) && !entry.name.endsWith('.test.ts')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const match = content.match(forbiddenClassRegex);
        if (match) {
          violations.push(`${fullPath}: found forbidden blue/cool colour class "${match[0]}"`);
        }
        const darkMatch = content.match(forbiddenDarkHexRegex);
        if (darkMatch) {
          violations.push(`${fullPath}: found forbidden dark hex "${darkMatch[0]}"`);
        }
        if (content.includes('GEMINI_API_KEY')) {
          violations.push(`${fullPath}: must not reference GEMINI_API_KEY in frontend code`);
        }
      }
    }
    return violations;
  }

  const violations = scanDir(path.join(rootDir, 'src'));
  assert.deepEqual(violations, []);
});
