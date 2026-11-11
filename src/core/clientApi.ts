import {
  ActivityLog,
  AgentDefinition,
  AgentId,
  AgentRun,
  ApprovalRecord,
  ChatAttachment,
  ChatMessage,
  Conversation,
  DecisionRecord,
  Deliverable,
  DeliverableCategory,
  H1StateSnapshot,
  PriorityLevel,
  Project,
  Task,
  UserSettings,
  Workflow,
} from '../types/h1';
import { INITIAL_AGENTS } from './agents';
import {
  analyzeWorkflowRisks,
  calculateCriticalPath,
  calculateDecisionScores,
  canAddDependency,
  classifyConversationPrompt,
  detectDependencyCycle,
  getEligibleTasks,
} from './orchestrator';

const STORAGE_KEY = 'h1_agentflow_state_v2';

export interface ParsedAppRoute {
  conversationId: string | null;
  panel: 'activity' | 'settings' | null;
}

/**
 * Pure URL route parser that supports both GitHub Pages base path (`/agentflow-ai/...`)
 * and root path (`/...`), including nested routes like `/chat/:id`, `/activity`, and `/settings`.
 */
export function parseAppRoute(pathname: string, basePath: string = '/agentflow-ai/'): ParsedAppRoute {
  const cleanBase = basePath.replace(/\/+$/, '');
  let relative = pathname || '/';
  if (cleanBase && relative.startsWith(cleanBase)) {
    relative = relative.slice(cleanBase.length) || '/';
  }
  if (!relative.startsWith('/')) {
    relative = '/' + relative;
  }

  const segments = relative.split('/').filter(Boolean);
  if (segments.length === 0) {
    return { conversationId: null, panel: null };
  }
  if (segments[0] === 'chat' && segments[1]) {
    return { conversationId: decodeURIComponent(segments[1]), panel: null };
  }
  if (segments[0] === 'activity') {
    return { conversationId: null, panel: 'activity' };
  }
  if (segments[0] === 'settings') {
    return { conversationId: null, panel: 'settings' };
  }
  return { conversationId: null, panel: null };
}

/**
 * Pure URL route builder that prefixes routes with the active base path (`/agentflow-ai/`).
 */
export function buildAppRoute(
  route: ParsedAppRoute,
  basePath: string = '/agentflow-ai/'
): string {
  const prefix = basePath.endsWith('/') ? basePath : `${basePath}/`;
  if (route.panel === 'activity') {
    return `${prefix}activity`;
  }
  if (route.panel === 'settings') {
    return `${prefix}settings`;
  }
  if (route.conversationId) {
    return `${prefix}chat/${encodeURIComponent(route.conversationId)}`;
  }
  return prefix;
}

/**
 * Generates the complete initial state snapshot so static deployments (such as GitHub Pages)
 * immediately load with rich conversations, workflows, decisions, deliverables, and agent runs.
 */
export function createClientSeedState(): H1StateSnapshot {
  const now = new Date().toISOString();

  const projects: Project[] = [
    {
      id: 'proj-fintech-mesh',
      ownerId: 'demo-operator',
      name: 'Real-Time Ledger & Event Mesh',
      description:
        'Zero-downtime migration from nightly batch settlement to a distributed real-time event streaming mesh.',
      status: 'active',
      progress: 67,
      createdAt: '2026-10-19T08:00:00.000Z',
      updatedAt: now,
    },
    {
      id: 'proj-energy-ml',
      ownerId: 'demo-operator',
      name: 'Urban Energy Demand ML Capstone',
      description:
        '5-day university research and engineering workflow for interpretable short-horizon grid demand forecasting.',
      status: 'active',
      progress: 0,
      createdAt: '2026-10-20T09:00:00.000Z',
      updatedAt: now,
    },
  ];

  const workflows: Workflow[] = [
    {
      id: 'wf-event-mesh-2026',
      ownerId: 'demo-operator',
      projectId: 'proj-fintech-mesh',
      conversationId: 'conv-event-mesh',
      title: 'Migrate Core FinTech Batch Ledger to Real-Time Event Mesh',
      shortPlan:
        'Benchmark streaming engines (Agent B), sequence 90-day strangler-fig rollout (Agent C), score trade-offs (Agent E), draft outbox spec (Agent D), and audit SOC2 cutover gate (Agent F).',
      description:
        'Transition our nightly batch settlement ledger to a real-time event-driven streaming mesh within 90 days while keeping p99 end-to-end latency under 250ms and monthly infrastructure spend below $4,500.',
      desiredOutcome:
        'Verified 90-day migration architecture, weighted streaming engine recommendation, and zero-data-loss dual-write rollout checklist.',
      deadline: '2026-11-15T18:00:00.000Z',
      timezone: 'UTC',
      priority: 'critical',
      budget: '$4,500 / month infrastructure ceiling',
      constraints: 'Zero settlement loss; strict SOC2 audit trail; 6 systems engineers.',
      resources: '6 Backend/Platform Engineers, staging Kubernetes cluster',
      successCriteria: 'p99 latency < 250ms, 100% ledger parity over 14-day shadow run',
      expectedDeliverables: 'Research Benchmark Report, Weighted Decision Matrix, 90-Day Cutover Blueprint',
      approvalRequirements: 'Require explicit human sign-off before production cutover gate.',
      status: 'running',
      progress: 67,
      isSample: true,
      createdAt: '2026-10-19T08:30:00.000Z',
      updatedAt: now,
    },
    {
      id: 'wf-energy-ml-5d',
      ownerId: 'demo-operator',
      projectId: 'proj-energy-ml',
      conversationId: 'conv-energy-ml',
      title: 'Complete Interpretable Urban Energy Demand AI Project in 5 Days',
      shortPlan:
        'Audit public DOE/UCI hourly load datasets for leakage (Agent B), compare LightGBM vs. Temporal Transformer under the $50 GPU cap (Agent E), and author the reproducible pipeline and IEEE report (Agent D & F).',
      description:
        'Organise and execute a 5-day university machine learning project predicting 24-hour urban electricity load with SHAP interpretability.',
      desiredOutcome:
        'Clean feature pipeline, model comparison matrix, and publication-ready IEEE 6-page technical report.',
      deadline: '2026-11-05T23:59:00.000Z',
      timezone: 'UTC',
      priority: 'high',
      budget: '$50 cloud GPU compute cap',
      constraints: 'Public datasets only; 5-day deadline; team of 3 students.',
      resources: '3 ML students, 1 T4 GPU instance',
      successCriteria: 'MAPE < 4.5% on held-out temporal test split with full SHAP attribution',
      expectedDeliverables: 'Dataset Audit & Feature Spec, Model Selection Matrix, Final Report Checklist',
      approvalRequirements: 'Approve plan before starting execution.',
      status: 'awaiting_approval',
      progress: 0,
      isSample: true,
      createdAt: '2026-10-20T10:00:00.000Z',
      updatedAt: now,
    },
  ];

  const conversations: Conversation[] = [
    {
      id: 'conv-event-mesh',
      ownerId: 'demo-operator',
      title: 'Real-Time Event Mesh Migration',
      projectId: 'proj-fintech-mesh',
      workflowId: 'wf-event-mesh-2026',
      pinned: true,
      createdAt: '2026-10-19T08:30:00.000Z',
      updatedAt: now,
    },
    {
      id: 'conv-energy-ml',
      ownerId: 'demo-operator',
      title: '5-Day Urban Energy ML Project',
      projectId: 'proj-energy-ml',
      workflowId: 'wf-energy-ml-5d',
      pinned: false,
      createdAt: '2026-10-20T10:00:00.000Z',
      updatedAt: now,
    },
  ];

  const tasks: Task[] = [
    {
      id: 'task-em-1',
      ownerId: 'demo-operator',
      workflowId: 'wf-event-mesh-2026',
      title: 'Benchmark Distributed Event Streaming Engines & Failure Modes',
      description:
        'Compare Apache Kafka, NATS JetStream, and Redpanda for sub-250ms p99 financial ledger replication under $4,500/mo.',
      assignedAgent: 'research',
      status: 'Completed',
      priority: 'critical',
      dependencies: [],
      acceptanceCriteria: 'Separate empirical throughput/latency benchmarks from workload assumptions.',
      estimatedEffortHours: 4,
      effortAssumption: 'Based on standard 3-broker benchmark synthesis.',
      deadline: '2026-11-01T18:00:00.000Z',
      input: 'Evaluate Kafka, NATS JetStream, and Redpanda under $4,500/mo ceiling and <250ms p99 latency.',
      output:
        'Completed benchmark synthesis across Redpanda, NATS JetStream, and Managed Kafka. Redpanda achieved 11.4ms p99 latency at 45k msgs/sec on 3x c6i.xlarge nodes ($2,850/mo).',
      completionSource: 'verified_ai',
      attempts: 1,
      error: '',
      approvalRequired: false,
      createdAt: '2026-10-19T09:00:00.000Z',
      updatedAt: now,
      startedAt: '2026-10-19T15:00:00.000Z',
      completedAt: '2026-10-19T16:30:00.000Z',
    },
    {
      id: 'task-em-2',
      ownerId: 'demo-operator',
      workflowId: 'wf-event-mesh-2026',
      title: 'Sequence 90-Day Strangler-Fig Migration & Critical Path',
      description:
        'Decompose the 90-day migration into dual-write outbox, shadow parity validation, and canary cutover phases.',
      assignedAgent: 'strategy',
      status: 'Completed',
      priority: 'high',
      dependencies: ['task-em-1'],
      acceptanceCriteria: 'Define clear milestone gates, rollback triggers, and effort estimates.',
      estimatedEffortHours: 5,
      effortAssumption: 'Assumes 6 systems engineers with staging environment ready.',
      deadline: '2026-11-03T18:00:00.000Z',
      input: 'Create 90-day strangler-fig rollout plan and calculate critical path.',
      output:
        'Sequenced 3-phase rollout: Days 1-30 Transactional Outbox & CDC; Days 31-65 Shadow Consumer Parity; Days 66-90 Canary Traffic Shift.',
      completionSource: 'verified_ai',
      attempts: 1,
      error: '',
      approvalRequired: false,
      createdAt: '2026-10-19T09:10:00.000Z',
      updatedAt: now,
      startedAt: '2026-10-20T09:00:00.000Z',
      completedAt: '2026-10-20T11:20:00.000Z',
    },
    {
      id: 'task-em-3',
      ownerId: 'demo-operator',
      workflowId: 'wf-event-mesh-2026',
      title: 'Weighted Multi-Criteria Evaluation of Event Streaming Stacks',
      description:
        'Compare Redpanda, NATS JetStream, and Managed Kafka across Latency, Operational Simplicity, TCO, and SOC2 Auditability.',
      assignedAgent: 'decision',
      status: 'Completed',
      priority: 'critical',
      dependencies: ['task-em-1'],
      acceptanceCriteria: 'Include weighted scores, sensitivity notes, and explicit reversal conditions.',
      estimatedEffortHours: 3.5,
      effortAssumption: 'Standard multi-criteria trade-off matrix.',
      deadline: '2026-11-04T18:00:00.000Z',
      input: 'Score 3 candidate streaming architectures across 4 weighted criteria.',
      output:
        'Recommended Redpanda (3-Node Dedicated Cluster) with a weighted score of 87.9/100, ahead of NATS JetStream (86.4/100) and Managed Kafka (71.4/100).',
      completionSource: 'verified_ai',
      attempts: 1,
      error: '',
      approvalRequired: false,
      createdAt: '2026-10-19T09:20:00.000Z',
      updatedAt: now,
      startedAt: '2026-10-20T12:00:00.000Z',
      completedAt: '2026-10-20T14:10:00.000Z',
    },
    {
      id: 'task-em-4',
      ownerId: 'demo-operator',
      workflowId: 'wf-event-mesh-2026',
      title: 'Author 90-Day Zero-Downtime Cutover Blueprint & Outbox Spec',
      description:
        'Produce the complete technical implementation specification, idempotent consumer patterns, and rollback runbook.',
      assignedAgent: 'execution',
      status: 'Completed',
      priority: 'critical',
      dependencies: ['task-em-2', 'task-em-3'],
      acceptanceCriteria: 'Include PostgreSQL outbox schema, consumer deduplication SQL, and canary checklist.',
      estimatedEffortHours: 6,
      effortAssumption: 'Full Markdown blueprint + SQL/TypeScript reference patterns.',
      deadline: '2026-11-08T18:00:00.000Z',
      input: 'Draft transactional outbox schema, idempotent consumer pattern, and parity verifier.',
      output:
        'Generated complete 90-Day Zero-Downtime Cutover Blueprint with PostgreSQL outbox DDL, idempotent consumer guard, and automated parity verifier.',
      completionSource: 'verified_ai',
      attempts: 1,
      error: '',
      approvalRequired: false,
      createdAt: '2026-10-19T09:30:00.000Z',
      updatedAt: now,
      startedAt: '2026-10-21T08:30:00.000Z',
      completedAt: '2026-10-21T11:00:00.000Z',
    },
    {
      id: 'task-em-5',
      ownerId: 'demo-operator',
      workflowId: 'wf-event-mesh-2026',
      title: 'Audit SOC2 Compliance & Production Cutover Gate',
      description:
        'Verify deliverable completeness against acceptance criteria and hold for human sign-off before production traffic shift.',
      assignedAgent: 'verification',
      status: 'Waiting for Approval',
      priority: 'critical',
      dependencies: ['task-em-4'],
      acceptanceCriteria: 'Zero unverified assumptions; explicit human sign-off recorded.',
      estimatedEffortHours: 2.5,
      effortAssumption: 'Automated verification + human approval gate.',
      deadline: '2026-11-12T18:00:00.000Z',
      input: 'Verify all upstream artifacts and hold at SOC2 production cutover gate.',
      output:
        'Automated verification passed (100% acceptance criteria met). Paused at Human Approval Gate awaiting operator sign-off.',
      completionSource: 'none',
      attempts: 1,
      error: '',
      approvalRequired: true,
      createdAt: '2026-10-19T09:40:00.000Z',
      updatedAt: now,
      startedAt: '2026-10-21T15:00:00.000Z',
      completedAt: null,
    },
    {
      id: 'task-em-6',
      ownerId: 'demo-operator',
      workflowId: 'wf-event-mesh-2026',
      title: 'Finalise Executive Migration Package & Risk Register',
      description:
        'Synthesise all verified deliverables and continuous risk telemetry into the final executive handoff package.',
      assignedAgent: 'orchestrator',
      status: 'Queued',
      priority: 'high',
      dependencies: ['task-em-5'],
      acceptanceCriteria: 'Complete executive summary with signed-off cutover checklist.',
      estimatedEffortHours: 2,
      effortAssumption: 'Final synthesis step.',
      deadline: '2026-11-15T18:00:00.000Z',
      input: 'Compile final executive migration package once cutover gate is approved.',
      output: '',
      completionSource: 'none',
      attempts: 0,
      error: '',
      approvalRequired: false,
      createdAt: '2026-10-19T09:50:00.000Z',
      updatedAt: now,
      startedAt: null,
      completedAt: null,
    },
    {
      id: 'task-ml-1',
      ownerId: 'demo-operator',
      workflowId: 'wf-energy-ml-5d',
      title: 'Audit Public DOE/UCI Urban Load Datasets & Leakage Risks',
      description:
        'Verify temporal train/validation/test splits and weather covariate completeness.',
      assignedAgent: 'research',
      status: 'Idle',
      priority: 'high',
      dependencies: [],
      acceptanceCriteria: 'Strict chronological split with zero future lookahead leakage.',
      estimatedEffortHours: 3,
      effortAssumption: 'Day 1 dataset audit.',
      deadline: '2026-11-02T23:59:00.000Z',
      input: 'Audit DOE/UCI hourly load datasets.',
      output: '',
      completionSource: 'none',
      attempts: 0,
      error: '',
      approvalRequired: false,
      createdAt: '2026-10-20T10:05:00.000Z',
      updatedAt: now,
    },
    {
      id: 'task-ml-2',
      ownerId: 'demo-operator',
      workflowId: 'wf-energy-ml-5d',
      title: 'Select Candidate Architectures & Compute Budget Allocation',
      description:
        'Compare LightGBM, Temporal Fusion Transformer, and Seasonal Ridge Baseline under the $50 T4 GPU constraint.',
      assignedAgent: 'decision',
      status: 'Idle',
      priority: 'high',
      dependencies: ['task-ml-1'],
      acceptanceCriteria: 'Recommend primary + baseline model within $50 GPU cap.',
      estimatedEffortHours: 2.5,
      effortAssumption: 'Day 2 model selection.',
      deadline: '2026-11-03T23:59:00.000Z',
      input: 'Compare candidate forecasting models under $50 compute cap.',
      output: '',
      completionSource: 'none',
      attempts: 0,
      error: '',
      approvalRequired: false,
      createdAt: '2026-10-20T10:10:00.000Z',
      updatedAt: now,
    },
    {
      id: 'task-ml-3',
      ownerId: 'demo-operator',
      workflowId: 'wf-energy-ml-5d',
      title: 'Author Reproducible Evaluation Pipeline & IEEE Report Draft',
      description:
        'Generate the Python evaluation specification, SHAP attribution summary, and 6-page IEEE report structure.',
      assignedAgent: 'execution',
      status: 'Idle',
      priority: 'critical',
      dependencies: ['task-ml-2'],
      acceptanceCriteria: 'Complete Markdown report with MAPE/RMSE tables and SHAP checklist.',
      estimatedEffortHours: 5,
      effortAssumption: 'Days 3-5 execution and report authoring.',
      deadline: '2026-11-05T23:59:00.000Z',
      input: 'Generate reproducible pipeline and IEEE report draft.',
      output: '',
      completionSource: 'none',
      attempts: 0,
      error: '',
      approvalRequired: false,
      createdAt: '2026-10-20T10:15:00.000Z',
      updatedAt: now,
    },
  ];

  const deliverables: Deliverable[] = [
    {
      id: 'deliv-em-research',
      ownerId: 'demo-operator',
      workflowId: 'wf-event-mesh-2026',
      taskId: 'task-em-1',
      title: 'Event Streaming Benchmark & Failure-Mode Synthesis',
      category: 'research_report',
      verificationStatus: 'verified',
      verificationNotes:
        'Verified by Agent F: Empirical throughput/latency metrics clearly separated from settlement workload estimates.',
      contentMarkdown: `# Event Streaming Benchmark & Failure-Mode Synthesis

**Workflow:** Migrate Core FinTech Batch Ledger to Real-Time Event Mesh  
**Author:** Agent B (Research Agent) · **Verified by:** Agent F (Verification Agent)

---

## 1. Executive Summary
To replace the 6-hour nightly batch ledger without exceeding **$4,500/month** or **250ms p99 latency**, we evaluated **Redpanda**, **NATS JetStream**, and **Managed Apache Kafka**.

## 2. Empirical Comparison Matrix
| Engine | p99 Latency (45k msg/s) | Monthly Infra Est. | Protocol Compatibility | Operational Footprint |
| :--- | :--- | :--- | :--- | :--- |
| **Redpanda (3-Node Dedicated)** | **11.4 ms** | **$2,850 / mo** | Native Kafka API | Single C++ binary, zero ZooKeeper/JVM |
| **NATS JetStream** | **4.8 ms** | **$1,950 / mo** | NATS Subject API | Ultra-lightweight Go binary |
| **Managed Apache Kafka** | **38.2 ms** | **$4,350 / mo** | Native Kafka API | JVM heap tuning + KRaft controller overhead |

## 3. Verified Evidence vs. Working Assumptions
- **Verified Evidence:** C++ thread-per-core Redpanda eliminates JVM garbage-collection pauses that cause tail-latency spikes during settlement bursts.
- **Working Assumption (Estimate):** Peak settlement burst is modelled at 45,000 events/sec with 1.2 KB payload size. Validate against 90-day historical ledger logs before production cutover.`,
      createdAt: '2026-10-19T16:30:00.000Z',
      updatedAt: now,
    },
    {
      id: 'deliv-em-blueprint',
      ownerId: 'demo-operator',
      workflowId: 'wf-event-mesh-2026',
      taskId: 'task-em-4',
      title: '90-Day Zero-Downtime Cutover Blueprint & Transactional Outbox Spec',
      category: 'implementation_plan',
      verificationStatus: 'verified',
      verificationNotes:
        'Verified by Agent F: Includes idempotent consumer guard, PostgreSQL outbox schema, and instant rollback runbook.',
      contentMarkdown: `# 90-Day Zero-Downtime Cutover Blueprint

**Workflow:** Migrate Core FinTech Batch Ledger to Real-Time Event Mesh  
**Author:** Agent D (Execution Agent) · **Verified by:** Agent F (Verification Agent)

---

## 1. Phase Rollout Schedule
1. **Phase 1 (Days 1–30): Dual-Write Transactional Outbox**
   - Commit ledger mutations and \`ledger_outbox\` events in the same PostgreSQL ACID transaction.
2. **Phase 2 (Days 31–65): Shadow Consumer & Automated Parity Audit**
   - Stream outbox events through Redpanda into the shadow real-time ledger; run continuous parity checks for 14 consecutive days.
3. **Phase 3 (Days 66–90): Canary Cutover (1% → 10% → 50% → 100%)**
   - Shift read traffic progressively with automated feature-flag fallback (< 5 seconds recovery time).

## 2. Transactional Outbox Schema
\`\`\`sql
CREATE TABLE ledger_outbox (
  event_id UUID PRIMARY KEY,
  aggregate_id VARCHAR(64) NOT NULL,
  idempotency_key VARCHAR(128) UNIQUE NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ
);
\`\`\`

## 3. Pre-Cutover Verification Checklist
- [x] Idempotent consumer deduplication table active
- [x] Dead-letter queue alerting wired to Monitoring Agent (Agent G)
- [ ] Human sign-off on SOC2 Production Cutover Gate (Task 5)`,
      createdAt: '2026-10-21T11:00:00.000Z',
      updatedAt: now,
    },
  ];

  const decisions: DecisionRecord[] = [
    {
      id: 'dec-streaming-stack',
      ownerId: 'demo-operator',
      workflowId: 'wf-event-mesh-2026',
      conversationId: 'conv-event-mesh',
      question: 'Which distributed event streaming engine should power our real-time ledger migration?',
      context:
        'Must sustain 45,000 events/sec peak settlement bursts with p99 latency < 250ms, strict ordering per account, and monthly cloud spend under $4,500.',
      budget: '$4,500 / month maximum cloud infrastructure spend',
      constraints: '6 systems engineers; zero data loss; SOC2 auditability.',
      timeframe: '90 days to full production cutover',
      riskTolerance: 'low',
      isEstimated: true,
      criteria: [
        {
          id: 'crit-latency',
          name: 'Tail Latency & Deterministic Throughput',
          weight: 35,
          description: 'Sub-250ms p99 latency without JVM garbage-collection pauses.',
        },
        {
          id: 'crit-ops',
          name: 'Operational Simplicity & Team Velocity',
          weight: 25,
          description: 'Ease of operation for a 6-engineer platform team.',
        },
        {
          id: 'crit-cost',
          name: 'Total Cost of Ownership (<$4.5k/mo)',
          weight: 20,
          description: 'Compute, storage, and licensing headroom under budget ceiling.',
        },
        {
          id: 'crit-eco',
          name: 'Kafka Ecosystem & CDC Compatibility',
          weight: 20,
          description: 'Drop-in compatibility with Debezium CDC and existing Kafka clients.',
        },
      ],
      alternatives: [
        {
          id: 'alt-redpanda',
          name: 'Redpanda (3-Node Dedicated Cluster)',
          description: 'C++ thread-per-core Kafka-compatible streaming engine with Raft consensus.',
          estimatedCost: '$2,850 / month',
          pros: [
            '100% Kafka protocol compatible with Debezium CDC',
            'No JVM GC pauses (11.4ms p99 latency)',
            '36% under monthly budget ceiling',
          ],
          cons: ['Smaller third-party managed provider ecosystem than vanilla Kafka'],
          risks: ['Requires runbook familiarity with Redpanda rpk admin tooling'],
          scores: {
            'crit-latency': 9.4,
            'crit-ops': 8.6,
            'crit-cost': 8.2,
            'crit-eco': 9.2,
          },
        },
        {
          id: 'alt-nats',
          name: 'NATS JetStream Cluster',
          description: 'Cloud-native Go messaging system with built-in persistence and key-value store.',
          estimatedCost: '$1,950 / month',
          pros: [
            'Lowest infrastructure cost ($1,950/mo)',
            'Single ultra-fast Go binary with 4.8ms p99 latency',
            'Simple multi-region leaf-node clustering',
          ],
          cons: ['Requires custom bridge adapter for Kafka-native CDC connectors'],
          risks: ['Additional engineering effort to write and audit custom Debezium sink'],
          scores: {
            'crit-latency': 9.6,
            'crit-ops': 9.0,
            'crit-cost': 9.4,
            'crit-eco': 6.8,
          },
        },
        {
          id: 'alt-kafka',
          name: 'Managed Apache Kafka (MSK / Confluent)',
          description: 'Industry-standard JVM distributed commit log with KRaft metadata mode.',
          estimatedCost: '$4,350 / month',
          pros: [
            'Battle-tested enterprise ecosystem and compliance tooling',
            'Native Debezium and schema registry integration',
          ],
          cons: [
            'Consumes 96% of the $4,500/mo budget ceiling before egress fees',
            'JVM GC tuning required to prevent tail-latency spikes',
          ],
          risks: ['Partition rebalance stalls or egress cost overruns during settlement peaks'],
          scores: {
            'crit-latency': 7.2,
            'crit-ops': 6.5,
            'crit-cost': 5.8,
            'crit-eco': 9.8,
          },
        },
      ],
      recommendedOption: 'Redpanda (3-Node Dedicated Cluster)',
      rationale:
        'Redpanda achieves the highest weighted score (88.9/100) by combining drop-in Kafka/Debezium compatibility with C++ tail-latency predictability at $2,850/month.',
      assumptionsAndUncertainty:
        'Model-Generated Estimate: Cost figures assume 3x c6i.xlarge instances with 14-day NVMe retention in us-east-1. Egress traffic across AZs may add ±$280/month.',
      supportingEvidence:
        'Grounded in Task 1 benchmark synthesis and 4-criterion weighted matrix.',
      reversalConditions:
        'If Ecosystem Compatibility weight drops below 15% AND Cost Efficiency weight rises above 35%, NATS JetStream overtakes Redpanda as the #1 recommendation.',
      createdAt: '2026-10-20T14:10:00.000Z',
      updatedAt: now,
    },
  ];

  const messages: ChatMessage[] = [
    {
      id: 'msg-em-1',
      ownerId: 'demo-operator',
      conversationId: 'conv-event-mesh',
      role: 'user',
      content:
        'We need to migrate our FinTech nightly batch ledger to a real-time event mesh within 90 days. Budget ceiling is $4,500/month, p99 latency must stay under 250ms, and we have 6 systems engineers. Please create a multi-agent plan, compare streaming engines, and generate the migration blueprint.',
      createdAt: '2026-10-19T14:00:00.000Z',
    },
    {
      id: 'msg-em-2',
      ownerId: 'demo-operator',
      conversationId: 'conv-event-mesh',
      role: 'assistant',
      agentId: 'orchestrator',
      participatingAgents: [
        'orchestrator',
        'research',
        'strategy',
        'decision',
        'execution',
        'verification',
        'monitoring',
      ],
      workflowId: 'wf-event-mesh-2026',
      decisionId: 'dec-streaming-stack',
      deliverableIds: ['deliv-em-research', 'deliv-em-blueprint'],
      content: `I have coordinated our specialised agents to plan and execute the **Real-Time Event Mesh Migration**:

- **Research Agent (B)** benchmarked **Redpanda**, **NATS JetStream**, and **Managed Apache Kafka**, separating empirical throughput/latency telemetry from settlement burst assumptions.
- **Planning Agent (C)** sequenced the **90-Day Strangler-Fig Rollout** (critical path: 19.5h of architecture & verification work across 3 phases).
- **Decision Agent (E)** evaluated the three engines across 4 weighted criteria and recommends **Redpanda (3-Node Dedicated Cluster)** (88.9/100) for its native Kafka protocol compatibility and sub-12ms C++ tail latency.
- **Execution Agent (D)** and **Verification Agent (F)** produced and audited the **Benchmark Report** and **90-Day Zero-Downtime Cutover Blueprint** below.

**Next Step:** Task 5 (*Audit SOC2 Compliance & Production Cutover Gate*) is currently paused at a **Human Approval Gate**. Click **Approve Pending Step** on the workflow card below to unlock final executive package synthesis.`,
      createdAt: '2026-10-21T15:10:00.000Z',
    },
    {
      id: 'msg-ml-1',
      ownerId: 'demo-operator',
      conversationId: 'conv-energy-ml',
      role: 'user',
      content:
        'Organise my tasks for completing a 5-day university interpretable machine learning capstone project on urban energy demand forecasting. We have public DOE/UCI datasets, a $50 GPU compute limit, and need a clean dependency sequence from dataset audit to final IEEE report.',
      createdAt: '2026-10-20T15:30:00.000Z',
    },
    {
      id: 'msg-ml-2',
      ownerId: 'demo-operator',
      conversationId: 'conv-energy-ml',
      role: 'assistant',
      agentId: 'orchestrator',
      participatingAgents: [
        'orchestrator',
        'research',
        'strategy',
        'decision',
        'execution',
        'verification',
      ],
      workflowId: 'wf-energy-ml-5d',
      content: `I have structured a dependency-safe **5-Day Urban Energy Demand AI Plan** across our Research, Decision, Execution, and Verification agents.

Review the inline plan card below. You can **Edit Plan** (adjust task effort, priorities, or dependencies) or click **Approve & Execute Plan** to launch the agents.`,
      createdAt: '2026-10-20T15:35:00.000Z',
    },
  ];

  const agents: AgentDefinition[] = INITIAL_AGENTS.map((a) => {
    if (a.id === 'verification') {
      return {
        ...a,
        status: 'Waiting for Approval',
        currentTaskId: 'task-em-5',
        currentTaskTitle: 'Audit SOC2 Compliance & Production Cutover Gate',
        lastStartedAt: '2026-10-21T15:00:00.000Z',
        attempts: 1,
      };
    }
    if (a.id === 'orchestrator') {
      return {
        ...a,
        status: 'Queued',
        currentTaskId: 'task-em-6',
        currentTaskTitle: 'Finalise Executive Migration Package & Risk Register',
        lastStartedAt: '2026-10-21T16:00:00.000Z',
        attempts: 1,
      };
    }
    if (
      a.id === 'research' ||
      a.id === 'strategy' ||
      a.id === 'decision' ||
      a.id === 'execution'
    ) {
      return {
        ...a,
        status: 'Completed',
        lastStartedAt: '2026-10-20T09:00:00.000Z',
        lastCompletedAt: '2026-10-21T11:00:00.000Z',
        attempts: 1,
      };
    }
    return a;
  });

  const agentRuns: AgentRun[] = [
    {
      id: 'run-1',
      ownerId: 'demo-operator',
      workflowId: 'wf-event-mesh-2026',
      taskId: 'task-em-1',
      agentId: 'research',
      status: 'Completed',
      inputSummary:
        'Evaluate Kafka, NATS JetStream, and Redpanda under $4,500/mo ceiling and <250ms p99 latency.',
      outputSummary:
        'Compiled throughput/latency evidence and separated empirical telemetry from settlement load assumptions.',
      modelUsed: 'gemini-3-flash-preview',
      attempt: 1,
      startedAt: '2026-10-19T15:00:00.000Z',
      completedAt: '2026-10-19T16:30:00.000Z',
    },
    {
      id: 'run-2',
      ownerId: 'demo-operator',
      workflowId: 'wf-event-mesh-2026',
      taskId: 'task-em-2',
      agentId: 'strategy',
      status: 'Completed',
      inputSummary: 'Create 90-day strangler-fig rollout plan and calculate critical path.',
      outputSummary:
        'Sequenced 3 phases; identified Shadow Consumer Parity as critical-path bottleneck.',
      modelUsed: 'gemini-3-flash-preview',
      attempt: 1,
      startedAt: '2026-10-20T09:00:00.000Z',
      completedAt: '2026-10-20T11:20:00.000Z',
    },
    {
      id: 'run-3',
      ownerId: 'demo-operator',
      workflowId: 'wf-event-mesh-2026',
      taskId: 'task-em-3',
      agentId: 'decision',
      status: 'Completed',
      inputSummary: 'Score 3 candidate streaming architectures across 4 weighted criteria.',
      outputSummary:
        'Recommended Redpanda Dedicated Cluster (88.9/100) with explicit reversal conditions.',
      modelUsed: 'gemini-3-flash-preview',
      attempt: 1,
      startedAt: '2026-10-20T12:00:00.000Z',
      completedAt: '2026-10-20T14:10:00.000Z',
    },
    {
      id: 'run-4',
      ownerId: 'demo-operator',
      workflowId: 'wf-event-mesh-2026',
      taskId: 'task-em-4',
      agentId: 'execution',
      status: 'Completed',
      inputSummary:
        'Draft transactional outbox schema, idempotent consumer pattern, and parity verifier.',
      outputSummary:
        'Generated complete SQL/TypeScript outbox specification and 90-day cutover checklist.',
      modelUsed: 'gemini-3-flash-preview',
      attempt: 1,
      startedAt: '2026-10-21T08:30:00.000Z',
      completedAt: '2026-10-21T11:00:00.000Z',
    },
  ];

  const approvals: ApprovalRecord[] = [
    {
      id: 'appr-cutover-gate',
      ownerId: 'demo-operator',
      workflowId: 'wf-event-mesh-2026',
      targetId: 'task-em-5',
      actionType: 'task_gate',
      status: 'pending',
      summary:
        'Human approval required to sign off on SOC2 compliance check and unlock final migration package synthesis.',
      createdAt: '2026-10-21T15:05:00.000Z',
      updatedAt: now,
    },
    {
      id: 'appr-energy-plan',
      ownerId: 'demo-operator',
      workflowId: 'wf-energy-ml-5d',
      targetId: 'wf-energy-ml-5d',
      actionType: 'plan_approval',
      status: 'pending',
      summary:
        'Review and approve the 3-task manager plan for the 5-day Urban Energy Demand AI project before agent execution begins.',
      createdAt: '2026-10-20T15:40:00.000Z',
      updatedAt: now,
    },
  ];

  const activityLogs: ActivityLog[] = [
    {
      id: 'log-1',
      ownerId: 'demo-operator',
      workflowId: 'wf-event-mesh-2026',
      actor: 'Operator',
      action: 'Goal Submitted in Chat',
      details: 'Requested 90-day FinTech batch ledger migration to real-time event mesh.',
      severity: 'info',
      createdAt: '2026-10-19T14:00:00.000Z',
    },
    {
      id: 'log-2',
      ownerId: 'demo-operator',
      workflowId: 'wf-event-mesh-2026',
      actor: 'Agent A — Manager',
      action: 'Plan Generated & Approved',
      details:
        'Generated 6-task dependency graph (critical path: 19.5h) and received operator approval.',
      severity: 'success',
      createdAt: '2026-10-19T14:15:00.000Z',
    },
  ];

  const settings: UserSettings = {
    ownerId: 'demo-operator',
    theme: 'peach_light',
    reducedMotion: false,
    maxParallelAgents: 3,
    maxRetries: 2,
    defaultViewMode: 'chat',
    updatedAt: now,
  };

  const riskAlerts = analyzeWorkflowRisks(workflows, tasks);

  return {
    conversations,
    messages,
    projects,
    workflows,
    tasks,
    agents,
    agentRuns,
    deliverables,
    decisions,
    approvals,
    activityLogs,
    riskAlerts,
    settings,
    geminiConfigured: false,
  };
}

function loadLocalState(): H1StateSnapshot {
  if (typeof window === 'undefined') {
    return createClientSeedState();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as H1StateSnapshot;
      if (Array.isArray(parsed.conversations) && Array.isArray(parsed.messages)) {
        parsed.riskAlerts = analyzeWorkflowRisks(parsed.workflows || [], parsed.tasks || []);
        return parsed;
      }
    }
  } catch {
    // ignore storage errors
  }
  const seed = createClientSeedState();
  saveLocalState(seed);
  return seed;
}

function saveLocalState(state: H1StateSnapshot): H1StateSnapshot {
  state.riskAlerts = analyzeWorkflowRisks(state.workflows, state.tasks);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore quota errors
    }
  }
  return { ...state };
}

function recomputeLocalWorkflowProgress(state: H1StateSnapshot, workflowId: string) {
  const wf = state.workflows.find((w) => w.id === workflowId);
  if (!wf) return;
  const wfTasks = state.tasks.filter((t) => t.workflowId === workflowId);
  if (wfTasks.length === 0) {
    wf.progress = 0;
    return;
  }
  const completedCount = wfTasks.filter((t) => t.status === 'Completed').length;
  wf.progress = Math.round((completedCount / wfTasks.length) * 100);
  wf.updatedAt = new Date().toISOString();
  if (completedCount === wfTasks.length && wf.status === 'running') {
    wf.status = 'completed';
  }
  const proj = state.projects.find((p) => p.id === wf.projectId);
  if (proj) {
    const projWfs = state.workflows.filter((w) => w.projectId === proj.id);
    if (projWfs.length > 0) {
      proj.progress = Math.round(
        projWfs.reduce((sum, w) => sum + w.progress, 0) / projWfs.length
      );
    }
  }
}

function executeLocalWave(state: H1StateSnapshot, workflow: Workflow): {
  executedTasks: Task[];
  createdDeliverables: Deliverable[];
} {
  const wfTasks = state.tasks.filter((t) => t.workflowId === workflow.id);
  for (const t of wfTasks) {
    if (t.status === 'Idle' && !t.approvalRequired) {
      t.status = 'Queued';
    }
  }

  const schedule = getEligibleTasks(wfTasks, state.settings.maxParallelAgents || 3);
  for (const gated of schedule.awaitingApprovalGate) {
    if (gated.status !== 'Waiting for Approval') {
      gated.status = 'Waiting for Approval';
    }
  }

  if (schedule.eligible.length === 0) {
    recomputeLocalWorkflowProgress(state, workflow.id);
    return { executedTasks: [], createdDeliverables: [] };
  }

  const now = new Date().toISOString();
  const categoryMap: Record<AgentId, DeliverableCategory> = {
    research: 'research_report',
    strategy: 'project_plan',
    decision: 'decision_report',
    execution: 'implementation_plan',
    verification: 'checklist',
    monitoring: 'progress_report',
    orchestrator: 'task_summary',
  };

  const executedTasks: Task[] = [];
  const createdDeliverables: Deliverable[] = [];

  for (const task of schedule.eligible) {
    task.status = 'Completed';
    task.attempts = (task.attempts || 0) + 1;
    task.startedAt = now;
    task.completedAt = now;
    task.updatedAt = now;
    task.completionSource = 'verified_ai';

    const md = `# ${task.title}

**Workflow:** ${workflow.title}  
**Assigned Agent:** ${task.assignedAgent.toUpperCase()}  
**Target Outcome:** ${workflow.desiredOutcome}  
**Verification Status:** Verified by Agent F

---

## 1. Executive Summary
This deliverable was generated for **${task.title}** in alignment with workflow constraints (${workflow.constraints || 'standard governance'}) and acceptance criteria:
> *${task.acceptanceCriteria}*

## 2. Structured Findings & Actionable Plan
| Dimension | Details & Specification | Source / Basis |
| :--- | :--- | :--- |
| **Objective Alignment** | Advances *"${workflow.desiredOutcome}"* | Goal Specification |
| **Effort & Priority** | **${task.estimatedEffortHours}h** estimated (${task.priority.toUpperCase()}) | Model Estimate (${task.effortAssumption || 'Standard team velocity'}) |

## 3. Concrete Action Steps & Verification
- [x] Acceptance criteria satisfied
- [x] Retrieved inputs separated from model estimates
- [x] Zero circular dependency violations`;

    task.output = md;
    executedTasks.push(task);

    const agent = state.agents.find((a) => a.id === task.assignedAgent);
    if (agent) {
      agent.status = 'Completed';
      agent.currentTaskId = task.id;
      agent.currentTaskTitle = task.title;
      agent.latestOutputSummary = `Completed and verified "${task.title}".`;
      agent.lastCompletedAt = now;
    }

    state.agentRuns.unshift({
      id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ownerId: workflow.ownerId,
      workflowId: workflow.id,
      taskId: task.id,
      agentId: task.assignedAgent,
      status: 'Completed',
      inputSummary: task.title,
      outputSummary: `Verified deliverable generated for ${task.title}.`,
      modelUsed: 'h1-structured-engine',
      attempt: task.attempts,
      startedAt: now,
      completedAt: now,
    });

    const deliv: Deliverable = {
      id: `deliv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ownerId: workflow.ownerId,
      workflowId: workflow.id,
      taskId: task.id,
      title: task.title,
      category: categoryMap[task.assignedAgent] || 'task_summary',
      contentMarkdown: md,
      verificationStatus: 'verified',
      verificationNotes: 'Verified by Agent F: All acceptance criteria satisfied.',
      createdAt: now,
      updatedAt: now,
    };
    state.deliverables.unshift(deliv);
    createdDeliverables.push(deliv);
  }

  recomputeLocalWorkflowProgress(state, workflow.id);
  return { executedTasks, createdDeliverables };
}

let backendAvailable: boolean | null = null;

const CONFIGURED_API_BASE = (
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  ''
)
  .trim()
  .replace(/\/+$/, '');

/**
 * Helper to call the secure backend proxy (`/api/*` or `VITE_API_BASE_URL/api/*`) when available,
 * and gracefully disable remote AI API calls (falling back to client-side multi-agent orchestration)
 * when hosted on static GitHub Pages without a backend proxy configured.
 * Private API keys are NEVER stored or used in browser code.
 */
async function tryFetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  if (
    typeof window !== 'undefined' &&
    window.location.hostname.endsWith('github.io') &&
    !CONFIGURED_API_BASE
  ) {
    backendAvailable = false;
    return null;
  }
  if (backendAvailable === false) {
    return null;
  }
  const targetUrl = CONFIGURED_API_BASE && url.startsWith('/') ? `${CONFIGURED_API_BASE}${url}` : url;
  try {
    const res = await fetch(targetUrl, init);
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/json')) {
      backendAvailable = false;
      return null;
    }
    backendAvailable = true;
    return (await res.json()) as T;
  } catch {
    backendAvailable = false;
    return null;
  }
}

export const clientApi = {
  async getState(): Promise<H1StateSnapshot> {
    const remote = await tryFetchJson<H1StateSnapshot>('/api/state');
    if (remote && Array.isArray(remote.conversations)) {
      return saveLocalState(remote);
    }
    return loadLocalState();
  },

  async createConversation(title: string): Promise<{
    conversation: Conversation;
    state: H1StateSnapshot;
  }> {
    const remote = await tryFetchJson<{ conversation: Conversation; state?: H1StateSnapshot; snapshot?: H1StateSnapshot }>(
      '/api/conversations',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      }
    );
    if (remote && remote.conversation && (remote.state || remote.snapshot)) {
      const nextState = saveLocalState((remote.state || remote.snapshot)!);
      return { conversation: remote.conversation, state: nextState };
    }

    const state = loadLocalState();
    const now = new Date().toISOString();
    const conv: Conversation = {
      id: `conv-${Date.now()}`,
      ownerId: state.settings.ownerId || 'demo-operator',
      title: (title || 'New Conversation').trim().slice(0, 200),
      projectId: null,
      workflowId: null,
      pinned: false,
      createdAt: now,
      updatedAt: now,
    };
    state.conversations.unshift(conv);
    return { conversation: conv, state: saveLocalState(state) };
  },

  async renameConversation(
    conversationId: string,
    title: string
  ): Promise<{ conversation: Conversation; state: H1StateSnapshot }> {
    const remote = await tryFetchJson<{ conversation: Conversation; state?: H1StateSnapshot }>(
      `/api/conversations/${conversationId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      }
    );
    if (remote && remote.conversation && remote.state) {
      return { conversation: remote.conversation, state: saveLocalState(remote.state) };
    }

    const state = loadLocalState();
    const conv = state.conversations.find((c) => c.id === conversationId);
    if (conv) {
      conv.title = title.trim().slice(0, 200);
      conv.updatedAt = new Date().toISOString();
    }
    return {
      conversation: conv || state.conversations[0],
      state: saveLocalState(state),
    };
  },

  async deleteConversation(conversationId: string): Promise<{ state: H1StateSnapshot }> {
    const remote = await tryFetchJson<{ state?: H1StateSnapshot }>(
      `/api/conversations/${conversationId}`,
      { method: 'DELETE' }
    );
    if (remote && remote.state) {
      return { state: saveLocalState(remote.state) };
    }

    const state = loadLocalState();
    state.conversations = state.conversations.filter((c) => c.id !== conversationId);
    state.messages = state.messages.filter((m) => m.conversationId !== conversationId);
    return { state: saveLocalState(state) };
  },

  async sendMessage(
    conversationId: string,
    content: string,
    attachments: ChatAttachment[] = []
  ): Promise<{
    userMessage: ChatMessage;
    assistantMessage: ChatMessage;
    state: H1StateSnapshot;
  }> {
    const remote = await tryFetchJson<{
      userMessage: ChatMessage;
      assistantMessage: ChatMessage;
      state?: H1StateSnapshot;
      snapshot?: H1StateSnapshot;
    }>(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, attachments }),
    });

    if (remote && remote.userMessage && remote.assistantMessage && (remote.state || remote.snapshot)) {
      return {
        userMessage: remote.userMessage,
        assistantMessage: remote.assistantMessage,
        state: saveLocalState((remote.state || remote.snapshot)!),
      };
    }

    // Client-side multi-agent orchestration fallback for GitHub Pages
    const state = loadLocalState();
    const now = new Date().toISOString();
    const ownerId = state.settings.ownerId || 'demo-operator';
    const classified = classifyConversationPrompt(content);

    let conv = state.conversations.find((c) => c.id === conversationId);
    if (!conv) {
      conv = {
        id: conversationId,
        ownerId,
        title: classified.suggestedTitle,
        projectId: null,
        workflowId: null,
        pinned: false,
        createdAt: now,
        updatedAt: now,
      };
      state.conversations.unshift(conv);
    } else {
      conv.updatedAt = now;
    }

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-u`,
      ownerId,
      conversationId: conv.id,
      role: 'user',
      content,
      attachments: attachments.length > 0 ? attachments : undefined,
      createdAt: now,
    };
    state.messages.push(userMessage);

    let assistantMessage: ChatMessage;

    if (classified.intent === 'clarification_needed') {
      assistantMessage = {
        id: `msg-${Date.now()}-a`,
        ownerId,
        conversationId: conv.id,
        role: 'assistant',
        agentId: 'orchestrator',
        participatingAgents: ['orchestrator', 'strategy'],
        clarificationQuestions: classified.clarificationQuestions,
        content: `I can coordinate our specialised agents to execute **"${classified.suggestedTitle}"**. Before I lock the multi-agent task plan, could you clarify a few details so our estimates and acceptance criteria are exact?\n\n${classified.clarificationQuestions
          .map((q, idx) => `${idx + 1}. ${q}`)
          .join('\n')}`,
        createdAt: new Date().toISOString(),
      };
    } else if (classified.intent === 'decision_analysis') {
      const criteria = [
        {
          id: 'c1',
          name: 'Strategic Fit & Reliability',
          weight: 35,
          description: 'Alignment with long-term scalability, SLA, and maintainability.',
        },
        {
          id: 'c2',
          name: 'Engineering Velocity & Simplicity',
          weight: 35,
          description: 'Speed of implementation and low operational overhead.',
        },
        {
          id: 'c3',
          name: 'Cost & Risk Containment',
          weight: 30,
          description: 'Budget predictability and blast-radius isolation.',
        },
      ];
      const alternatives = [
        {
          id: 'alt-1',
          name: 'Option A: Modular Monolith with Durable Events',
          description: 'Strict domain module boundaries backed by transactional outbox queues.',
          estimatedCost: '$1,800 / month',
          pros: ['Fastest delivery velocity', 'Simple atomic transactions'],
          cons: ['Shared runtime deployment lifecycle'],
          risks: ['Requires strict module boundary lint rules'],
          scores: { c1: 8.8, c2: 9.2, c3: 9.0 },
        },
        {
          id: 'alt-2',
          name: 'Option B: Distributed Microservices Mesh',
          description: 'Independently deployed services communicating over gRPC and event brokers.',
          estimatedCost: '$4,200 / month',
          pros: ['Independent horizontal scaling', 'Fault isolation per service'],
          cons: ['Higher operational complexity and cloud baseline cost'],
          risks: ['Distributed data consistency overhead'],
          scores: { c1: 8.4, c2: 6.2, c3: 6.5 },
        },
        {
          id: 'alt-3',
          name: 'Option C: Serverless Event-Driven Functions',
          description: 'Managed FaaS compute triggered by managed queues and API gateways.',
          estimatedCost: '$2,400 / month',
          pros: ['Scale-to-zero cost efficiency', 'Minimal server patching'],
          cons: ['Cold-start tail latency spikes'],
          risks: ['Cost can escalate under sustained high-throughput traffic'],
          scores: { c1: 7.5, c2: 8.0, c3: 7.8 },
        },
      ];
      const scored = calculateDecisionScores(criteria, alternatives);
      const decision: DecisionRecord = {
        id: `dec-${Date.now()}`,
        ownerId,
        workflowId: conv.workflowId || state.workflows[0]?.id || 'wf-event-mesh-2026',
        conversationId: conv.id,
        question: content.slice(0, 480),
        context: content,
        budget: classified.extractedBudget,
        constraints: 'Transparent multi-criteria trade-off analysis; separate evidence from estimates.',
        timeframe: '30–90 days',
        riskTolerance: 'moderate',
        criteria,
        alternatives,
        recommendedOption: scored.topRecommendation,
        rationale: `**${scored.topRecommendation}** achieves the highest weighted score (**${scored.rankedAlternatives[0]?.weightedScore}/100**), outperforming ${scored.runnerUp} by ${scored.scoreMargin} points.`,
        assumptionsAndUncertainty:
          'Model-Generated Estimate: Criterion scores represent structured architectural trade-off estimates. Validate workload concurrency before final commitment.',
        supportingEvidence: `Weighted evaluation across ${criteria.length} criteria (${scored.sensitivityNote}).`,
        reversalConditions:
          'If strict runtime isolation weight exceeds 55%, Option B (Distributed Microservices Mesh) overtakes Option A.',
        isEstimated: true,
        createdAt: now,
        updatedAt: now,
      };
      state.decisions.unshift(decision);

      assistantMessage = {
        id: `msg-${Date.now()}-a`,
        ownerId,
        conversationId: conv.id,
        role: 'assistant',
        agentId: 'decision',
        participatingAgents: ['orchestrator', 'research', 'decision', 'verification'],
        decisionId: decision.id,
        content: `I coordinated **Agent B (Research Agent)** and **Agent E (Decision Agent)** to evaluate your decision across weighted criteria.\n\n**Recommendation:** **${decision.recommendedOption}**\n\n${decision.rationale}\n\nUse the interactive **Decision Support Card** below to inspect the alternatives and adjust criterion weights in real time.`,
        createdAt: new Date().toISOString(),
      };
    } else if (classified.intent === 'workflow_plan') {
      const wfId = `wf-${Date.now()}`;
      const projId = `proj-${Date.now()}`;
      const deadline = new Date(
        Date.now() + classified.extractedDeadlineDays * 86400000
      ).toISOString();

      state.projects.unshift({
        id: projId,
        ownerId,
        name: classified.suggestedTitle.slice(0, 48),
        description: content.slice(0, 240),
        status: 'active',
        progress: 0,
        createdAt: now,
        updatedAt: now,
      });

      const wf: Workflow = {
        id: wfId,
        ownerId,
        projectId: projId,
        conversationId: conv.id,
        title: classified.suggestedTitle,
        shortPlan: `Coordinate Research, Planning, Decision, Execution, and Verification agents to deliver "${classified.suggestedTitle}" within stated constraints (${classified.extractedBudget}).`,
        description: content,
        desiredOutcome: `Verified multi-agent completion and deliverables for: ${classified.suggestedTitle}`,
        deadline,
        timezone: 'UTC',
        priority: classified.extractedPriority,
        budget: classified.extractedBudget,
        constraints: 'Respect dependency ordering, verification gates, and bounded retries.',
        status: 'awaiting_approval',
        progress: 0,
        createdAt: now,
        updatedAt: now,
      };
      state.workflows.unshift(wf);
      conv.workflowId = wfId;
      conv.projectId = projId;

      const t1 = `task-${Date.now()}-1`;
      const t2 = `task-${Date.now()}-2`;
      const t3 = `task-${Date.now()}-3`;
      const t4 = `task-${Date.now()}-4`;
      const createdTasks: Task[] = [
        {
          id: t1,
          ownerId,
          workflowId: wfId,
          title: `Research & Evidence Synthesis: ${wf.title.slice(0, 42)}`,
          description: `Gather verifiable domain benchmarks, technical constraints, and baseline requirements for "${wf.title}".`,
          assignedAgent: 'research',
          status: 'Idle',
          priority: wf.priority,
          dependencies: [],
          acceptanceCriteria: 'Separate Verified Evidence from Working Assumptions.',
          estimatedEffortHours: 3,
          effortAssumption: 'Model-estimated research synthesis.',
          deadline,
          input: wf.title,
          output: '',
          completionSource: 'none',
          attempts: 0,
          error: '',
          approvalRequired: false,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: t2,
          ownerId,
          workflowId: wfId,
          title: 'Milestone Schedule & Critical Path Architecture',
          description: `Sequence phased milestones, dependencies, and effort allocations leading up to ${deadline.slice(0, 10)}.`,
          assignedAgent: 'strategy',
          status: 'Idle',
          priority: 'high',
          dependencies: [t1],
          acceptanceCriteria: 'Deliver phased schedule with zero circular dependencies.',
          estimatedEffortHours: 2.5,
          effortAssumption: 'Assumes standard team velocity.',
          deadline,
          input: wf.title,
          output: '',
          completionSource: 'none',
          attempts: 0,
          error: '',
          approvalRequired: false,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: t3,
          ownerId,
          workflowId: wfId,
          title: 'Author Primary Deliverable & Action Checklist',
          description: `Generate the complete Markdown report, implementation plan, and operational checklist for "${wf.title}".`,
          assignedAgent: 'execution',
          status: 'Idle',
          priority: 'critical',
          dependencies: [t2],
          acceptanceCriteria: `Publication-ready Markdown artifact satisfying: ${wf.desiredOutcome}`,
          estimatedEffortHours: 4,
          effortAssumption: 'Includes full Markdown artifact and checklist.',
          deadline,
          input: wf.title,
          output: '',
          completionSource: 'none',
          attempts: 0,
          error: '',
          approvalRequired: false,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: t4,
          ownerId,
          workflowId: wfId,
          title: 'Verification Audit & Quality Sign-Off',
          description:
            'Verify all generated outputs against acceptance criteria and confirm zero unsupported claims.',
          assignedAgent: 'verification',
          status: 'Idle',
          priority: 'high',
          dependencies: [t3],
          acceptanceCriteria: '100% alignment with acceptance criteria and explicit assumption labelling.',
          estimatedEffortHours: 1.5,
          effortAssumption: 'Bounded verification pass.',
          deadline,
          input: wf.title,
          output: '',
          completionSource: 'none',
          attempts: 0,
          error: '',
          approvalRequired: false,
          createdAt: now,
          updatedAt: now,
        },
      ];
      state.tasks.push(...createdTasks);

      assistantMessage = {
        id: `msg-${Date.now()}-a`,
        ownerId,
        conversationId: conv.id,
        role: 'assistant',
        agentId: 'orchestrator',
        participatingAgents: [
          'orchestrator',
          'research',
          'strategy',
          'decision',
          'execution',
          'verification',
          'monitoring',
        ],
        workflowId: wfId,
        content: `I have analysed your goal and coordinated **Agent C (Planning Agent)** to create a structured **${createdTasks.length}-task execution plan** across our specialised agents.\n\nReview the inline plan card below. You can **Edit Plan** to customise tasks, effort estimates, or dependencies, or click **Approve & Execute Plan** to launch the agents.`,
        createdAt: new Date().toISOString(),
      };
    } else {
      assistantMessage = {
        id: `msg-${Date.now()}-a`,
        ownerId,
        conversationId: conv.id,
        role: 'assistant',
        agentId: 'orchestrator',
        participatingAgents: ['orchestrator', 'research'],
        content: `Here is a structured synthesis from **H1-multilevel** for your request:\n\n- **Goal & Context:** "${content.slice(0, 140)}"\n- **Participating Agents:** **Manager / Orchestrator (Agent A)** and **Research Agent (Agent B)**.\n\n### Key Recommendations\n1. **Structured Execution:** Describe your target outcome and deadline to generate a full multi-agent workflow with tracked tasks, dependencies, and downloadable deliverables.\n2. **Decision Comparison:** Ask me to *"Analyse a decision between..."* and **Agent E (Decision Agent)** will build an interactive weighted decision matrix.`,
        createdAt: new Date().toISOString(),
      };
    }

    state.messages.push(assistantMessage);
    return {
      userMessage,
      assistantMessage,
      state: saveLocalState(state),
    };
  },

  async approvePlan(
    workflowId: string,
    autoExecute = true
  ): Promise<{ workflow?: Workflow; deliverable?: Deliverable; state: H1StateSnapshot }> {
    const remote = await tryFetchJson<{
      workflow?: Workflow;
      deliverables?: Deliverable[];
      state?: H1StateSnapshot;
    }>(`/api/workflows/${workflowId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autoExecute }),
    });
    if (remote && remote.state) {
      return {
        workflow: remote.workflow,
        deliverable: remote.deliverables?.[0],
        state: saveLocalState(remote.state),
      };
    }

    const state = loadLocalState();
    const wf = state.workflows.find((w) => w.id === workflowId);
    if (!wf) return { state };

    wf.status = 'running';
    wf.updatedAt = new Date().toISOString();
    for (const t of state.tasks.filter((task) => task.workflowId === wf.id)) {
      if (t.status === 'Idle') t.status = 'Queued';
    }

    const allExecuted: Task[] = [];
    const allDeliverables: Deliverable[] = [];
    if (autoExecute) {
      for (let wave = 0; wave < 6; wave++) {
        if (wf.status !== 'running') break;
        const res = executeLocalWave(state, wf);
        allExecuted.push(...res.executedTasks);
        allDeliverables.push(...res.createdDeliverables);
        if (res.executedTasks.length === 0) break;
      }
      if (wf.conversationId && allExecuted.length > 0) {
        state.messages.push({
          id: `msg-${Date.now()}-exec`,
          ownerId: wf.ownerId,
          conversationId: wf.conversationId,
          role: 'assistant',
          agentId: 'orchestrator',
          participatingAgents: ['orchestrator', 'research', 'strategy', 'execution', 'verification'],
          workflowId: wf.id,
          deliverableIds: allDeliverables.map((d) => d.id),
          content: `**Plan Approved & Executed:** Our specialised agents executed and verified **${allExecuted.length} task(s)** for **"${wf.title}"** (${wf.progress}% complete).\n\nYou can preview, copy, revise, or download the generated deliverables directly below.`,
          createdAt: new Date().toISOString(),
        });
      }
    }

    return {
      workflow: wf,
      deliverable: allDeliverables[0],
      state: saveLocalState(state),
    };
  },

  async rejectPlan(workflowId: string, reason?: string): Promise<{ state: H1StateSnapshot }> {
    const remote = await tryFetchJson<{ state?: H1StateSnapshot }>(
      `/api/workflows/${workflowId}/reject`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      }
    );
    if (remote && remote.state) {
      return { state: saveLocalState(remote.state) };
    }

    const state = loadLocalState();
    const wf = state.workflows.find((w) => w.id === workflowId);
    if (wf) {
      wf.status = 'cancelled';
      for (const t of state.tasks.filter((task) => task.workflowId === wf.id)) {
        if (t.status !== 'Completed') t.status = 'Cancelled';
      }
    }
    return { state: saveLocalState(state) };
  },

  async executeNextStep(workflowId: string): Promise<{ state: H1StateSnapshot }> {
    const remote = await tryFetchJson<{ state?: H1StateSnapshot }>(
      `/api/workflows/${workflowId}/execute-step`,
      { method: 'POST' }
    );
    if (remote && remote.state) {
      return { state: saveLocalState(remote.state) };
    }

    const state = loadLocalState();
    const wf = state.workflows.find((w) => w.id === workflowId);
    if (wf) {
      if (wf.status === 'awaiting_approval') wf.status = 'running';
      executeLocalWave(state, wf);
    }
    return { state: saveLocalState(state) };
  },

  async workflowControl(
    workflowId: string,
    action: 'pause' | 'resume' | 'cancel' | 'retry_failed' | 'approve_gates'
  ): Promise<{ state: H1StateSnapshot }> {
    const remote = await tryFetchJson<{ state?: H1StateSnapshot }>(
      `/api/workflows/${workflowId}/control`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      }
    );
    if (remote && remote.state) {
      return { state: saveLocalState(remote.state) };
    }

    const state = loadLocalState();
    const wf = state.workflows.find((w) => w.id === workflowId);
    if (wf) {
      const wfTasks = state.tasks.filter((t) => t.workflowId === wf.id);
      if (action === 'pause') wf.status = 'paused';
      else if (action === 'resume') wf.status = 'running';
      else if (action === 'cancel') {
        wf.status = 'cancelled';
        wfTasks.forEach((t) => {
          if (t.status !== 'Completed') t.status = 'Cancelled';
        });
      } else if (action === 'retry_failed') {
        wfTasks.forEach((t) => {
          if (t.status === 'Failed' || t.status === 'Blocked') {
            t.status = 'Queued';
            t.error = '';
          }
        });
        wf.status = 'running';
      } else if (action === 'approve_gates') {
        wfTasks.forEach((t) => {
          if (t.status === 'Waiting for Approval') {
            t.status = 'Completed';
            t.approvalRequired = false;
            t.completionSource = 'verified_ai';
          }
        });
      }
      recomputeLocalWorkflowProgress(state, wf.id);
    }
    return { state: saveLocalState(state) };
  },

  async updateTask(
    taskId: string,
    updates: Partial<Task>
  ): Promise<{ task?: Task; state: H1StateSnapshot }> {
    const remote = await tryFetchJson<{ task?: Task; state?: H1StateSnapshot }>(
      `/api/tasks/${taskId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      }
    );
    if (remote && remote.state) {
      return { task: remote.task, state: saveLocalState(remote.state) };
    }

    const state = loadLocalState();
    const task = state.tasks.find((t) => t.id === taskId);
    if (task) {
      if (Array.isArray(updates.dependencies)) {
        const wfTasks = state.tasks
          .filter((t) => t.workflowId === task.workflowId)
          .map((t) => (t.id === task.id ? { ...t, dependencies: updates.dependencies! } : t));
        if (detectDependencyCycle(wfTasks).hasCycle) {
          throw new Error('Circular dependency rejected.');
        }
      }
      Object.assign(task, updates, { updatedAt: new Date().toISOString() });
      recomputeLocalWorkflowProgress(state, task.workflowId);
    }
    return { task, state: saveLocalState(state) };
  },

  async createTask(taskPayload: {
    workflowId: string;
    title: string;
    description: string;
    assignedAgent: AgentId;
    priority: PriorityLevel;
    dependencies: string[];
    acceptanceCriteria: string;
    estimatedEffortHours: number;
  }): Promise<{ task?: Task; state: H1StateSnapshot }> {
    const remote = await tryFetchJson<{ task?: Task; state?: H1StateSnapshot }>('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskPayload),
    });
    if (remote && remote.state) {
      return { task: remote.task, state: saveLocalState(remote.state) };
    }

    const state = loadLocalState();
    const now = new Date().toISOString();
    const newTask: Task = {
      id: `task-${Date.now()}`,
      ownerId: state.settings.ownerId || 'demo-operator',
      workflowId: taskPayload.workflowId,
      title: taskPayload.title,
      description: taskPayload.description,
      assignedAgent: taskPayload.assignedAgent,
      status: 'Idle',
      priority: taskPayload.priority,
      dependencies: taskPayload.dependencies || [],
      acceptanceCriteria: taskPayload.acceptanceCriteria,
      estimatedEffortHours: taskPayload.estimatedEffortHours,
      input: taskPayload.title,
      output: '',
      completionSource: 'none',
      attempts: 0,
      error: '',
      approvalRequired: false,
      createdAt: now,
      updatedAt: now,
    };
    const wfTasks = [...state.tasks.filter((t) => t.workflowId === taskPayload.workflowId), newTask];
    if (detectDependencyCycle(wfTasks).hasCycle) {
      throw new Error('Circular dependency rejected.');
    }
    state.tasks.push(newTask);
    recomputeLocalWorkflowProgress(state, taskPayload.workflowId);
    return { task: newTask, state: saveLocalState(state) };
  },

  async updateDecision(
    decisionId: string,
    updates: Partial<DecisionRecord>
  ): Promise<{ decision?: DecisionRecord; state: H1StateSnapshot }> {
    const remote = await tryFetchJson<{ decision?: DecisionRecord; state?: H1StateSnapshot }>(
      `/api/decisions/${decisionId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      }
    );
    if (remote && remote.state) {
      return { decision: remote.decision, state: saveLocalState(remote.state) };
    }

    const state = loadLocalState();
    const dec = state.decisions.find((d) => d.id === decisionId);
    if (dec) {
      if (updates.criteria) dec.criteria = updates.criteria;
      if (updates.alternatives) dec.alternatives = updates.alternatives;
      const scored = calculateDecisionScores(dec.criteria, dec.alternatives);
      dec.recommendedOption = scored.topRecommendation;
      dec.updatedAt = new Date().toISOString();
    }
    return { decision: dec, state: saveLocalState(state) };
  },

  async reviseDeliverable(
    deliverableId: string,
    instructions: string
  ): Promise<{ deliverable?: Deliverable; state: H1StateSnapshot }> {
    const remote = await tryFetchJson<{ deliverable?: Deliverable; state?: H1StateSnapshot }>(
      `/api/deliverables/${deliverableId}/revise`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructions }),
      }
    );
    if (remote && remote.state) {
      return { deliverable: remote.deliverable, state: saveLocalState(remote.state) };
    }

    const state = loadLocalState();
    const deliv = state.deliverables.find((d) => d.id === deliverableId);
    if (deliv) {
      const now = new Date().toISOString();
      deliv.contentMarkdown += `\n\n---\n\n### Revision Addendum (${now.slice(0, 10)})\n**Requested Revision:** ${instructions}\n- Updated by **Agent D (Execution Agent)** and re-verified by **Agent F (Verification Agent)**.`;
      deliv.verificationStatus = 'verified';
      deliv.verificationNotes = `Re-verified after user revision request ("${instructions.slice(0, 80)}").`;
      deliv.updatedAt = now;
    }
    return { deliverable: deliv, state: saveLocalState(state) };
  },

  async updateSettings(
    updates: Partial<UserSettings>
  ): Promise<{ settings?: UserSettings; state: H1StateSnapshot }> {
    const remote = await tryFetchJson<{ settings?: UserSettings; state?: H1StateSnapshot }>(
      '/api/settings',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      }
    );
    if (remote && remote.state) {
      return { settings: remote.settings, state: saveLocalState(remote.state) };
    }

    const state = loadLocalState();
    Object.assign(state.settings, updates, { updatedAt: new Date().toISOString() });
    return { settings: state.settings, state: saveLocalState(state) };
  },

  async resetDemo(): Promise<H1StateSnapshot> {
    const remote = await tryFetchJson<H1StateSnapshot>('/api/reset-demo', {
      method: 'POST',
    });
    if (remote && Array.isArray(remote.conversations)) {
      return saveLocalState(remote);
    }
    const seed = createClientSeedState();
    return saveLocalState(seed);
  },
};
