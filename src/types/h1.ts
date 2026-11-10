export type AgentId =
  | 'orchestrator'
  | 'research'
  | 'strategy'
  | 'execution'
  | 'decision'
  | 'verification'
  | 'monitoring';

export type AgentStatus =
  | 'Idle'
  | 'Queued'
  | 'Running'
  | 'Waiting for Approval'
  | 'Completed'
  | 'Failed'
  | 'Blocked'
  | 'Cancelled';

export type PriorityLevel = 'low' | 'medium' | 'high' | 'critical';

export type WorkflowStatus =
  | 'draft'
  | 'awaiting_approval'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface AgentDefinition {
  id: AgentId;
  code: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  name: string;
  shortName: string;
  role: string;
  instructions: string;
  inputSchemaDescription: string;
  outputSchemaDescription: string;
  accentColor: string;
  badgeBg: string;
  status: AgentStatus;
  currentTaskId: string | null;
  currentTaskTitle: string | null;
  latestInputSummary: string;
  latestOutputSummary: string;
  lastStartedAt: string | null;
  lastCompletedAt: string | null;
  attempts: number;
  errorDetails: string | null;
  modelUsed: string;
}

export interface ChatAttachment {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  contentPreview: string;
}

export interface ChatMessage {
  id: string;
  ownerId: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  agentId?: AgentId;
  participatingAgents?: AgentId[];
  workflowId?: string | null;
  decisionId?: string | null;
  deliverableIds?: string[];
  clarificationQuestions?: string[];
  attachments?: ChatAttachment[];
  isError?: boolean;
  createdAt: string;
}

export interface Conversation {
  id: string;
  ownerId: string;
  title: string;
  projectId?: string | null;
  workflowId?: string | null;
  pinned?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SuggestionCard {
  id: string;
  label: string;
  subtitle: string;
  prompt: string;
  intent: 'plan' | 'research' | 'decision' | 'tasks';
}

export interface Project {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'archived';
  progress: number;
  createdAt: string;
  updatedAt: string;
}

export interface Workflow {
  id: string;
  ownerId: string;
  projectId: string;
  conversationId?: string;
  title: string;
  shortPlan: string;
  description: string;
  desiredOutcome: string;
  deadline: string;
  timezone: string;
  priority: PriorityLevel;
  budget?: string;
  constraints?: string;
  resources?: string;
  successCriteria?: string;
  expectedDeliverables?: string;
  approvalRequirements?: string;
  status: WorkflowStatus;
  progress: number;
  isSample?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  ownerId: string;
  workflowId: string;
  title: string;
  description: string;
  assignedAgent: AgentId;
  status: AgentStatus;
  priority: PriorityLevel;
  dependencies: string[];
  acceptanceCriteria: string;
  estimatedEffortHours: number;
  effortAssumption?: string;
  deadline?: string;
  notes?: string;
  input: string;
  output: string;
  completionSource: 'none' | 'verified_ai' | 'user_manual';
  attempts: number;
  maxCorrectionCycles?: number;
  error: string;
  approvalRequired: boolean;
  waivedDependencies?: boolean;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface AgentRun {
  id: string;
  ownerId: string;
  workflowId: string;
  taskId: string;
  agentId: AgentId;
  status: 'Running' | 'Completed' | 'Failed';
  inputSummary: string;
  outputSummary: string;
  modelUsed: string;
  attempt: number;
  startedAt: string;
  completedAt: string;
  error?: string;
}

export type DeliverableCategory =
  | 'research_report'
  | 'project_plan'
  | 'decision_report'
  | 'task_summary'
  | 'checklist'
  | 'implementation_plan'
  | 'progress_report';

export interface Deliverable {
  id: string;
  ownerId: string;
  workflowId: string;
  taskId: string;
  title: string;
  category: DeliverableCategory;
  contentMarkdown: string;
  verificationStatus: 'verified' | 'needs_revision' | 'user_accepted';
  verificationNotes: string;
  createdAt: string;
  updatedAt: string;
}

export interface DecisionCriterion {
  id: string;
  name: string;
  weight: number; // 1 to 100
  description: string;
}

export interface DecisionAlternative {
  id: string;
  name: string;
  description: string;
  estimatedCost: string;
  pros: string[];
  cons: string[];
  risks: string[];
  scores: Record<string, number>; // criterionId -> 1..10 score
}

export interface DecisionRecord {
  id: string;
  ownerId: string;
  workflowId: string;
  conversationId?: string;
  question: string;
  context: string;
  budget: string;
  constraints: string;
  timeframe: string;
  riskTolerance: 'low' | 'moderate' | 'high';
  criteria: DecisionCriterion[];
  alternatives: DecisionAlternative[];
  recommendedOption: string;
  rationale: string;
  assumptionsAndUncertainty: string;
  supportingEvidence: string;
  reversalConditions: string;
  isEstimated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalRecord {
  id: string;
  ownerId: string;
  workflowId: string;
  targetId: string;
  actionType: 'plan_approval' | 'task_gate' | 'external_action';
  status: 'pending' | 'approved' | 'rejected';
  summary: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  ownerId: string;
  workflowId: string;
  actor: string;
  action: string;
  details: string;
  severity?: 'info' | 'warning' | 'error' | 'success';
  createdAt: string;
}

export interface RiskAlert {
  id: string;
  workflowId: string;
  workflowTitle: string;
  taskId?: string;
  severity: 'medium' | 'high' | 'critical';
  category: 'overdue' | 'blocker' | 'repeated_failure' | 'approval_bottleneck' | 'critical_path';
  title: string;
  description: string;
  correctiveAction: string;
  detectedAt: string;
}

export interface UserSettings {
  ownerId: string;
  theme: 'peach_light' | 'warm_ivory';
  reducedMotion: boolean;
  maxParallelAgents: number;
  maxRetries: number;
  defaultViewMode: 'chat' | 'compact';
  updatedAt: string;
}

export interface GoalValidationResult {
  valid: boolean;
  errors: string[];
  missingDetails: string[];
  clarificationQuestions: string[];
}

export interface H1StateSnapshot {
  conversations: Conversation[];
  messages: ChatMessage[];
  projects: Project[];
  workflows: Workflow[];
  tasks: Task[];
  agents: AgentDefinition[];
  agentRuns: AgentRun[];
  deliverables: Deliverable[];
  decisions: DecisionRecord[];
  approvals: ApprovalRecord[];
  activityLogs: ActivityLog[];
  riskAlerts: RiskAlert[];
  settings: UserSettings;
  geminiConfigured: boolean;
}
